// HTTP: a controller that returns Result<E, T> answers T, or the error's status (AppError) with its message.
import {
  ArgumentMetadata,
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  INestApplication,
  Injectable,
  NestInterceptor,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Observable, map } from 'rxjs';
import { DatabaseError, ForeignKeyConstraintError, ValidationError } from 'sequelize';
import { AppConfig } from './config.js';
import { INT_MAX, INT_MIN, MAX_BODY_SIZE, MAX_PAGE_SIZE, RawBody, Unreadable, edge, limits, logCause, readJson } from './edge.js';
import { AppError, InvalidInput, Invalidity, Reason, errorBody, reason, reasonsOf } from './errors.js';
import { Guard, GuardsOf, Headers, headersOf, refusal } from './guards.js';
import { answerOf } from './model.js';
import { Result } from './result.js';

@Injectable()
export class ResultInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (!(value instanceof Result)) return answerOf(value);
        const r = value as Result<unknown, unknown>;
        if (r.isOk) return answerOf(r.value);
        const e = r.error;
        throw e instanceof AppError ? e : new AppError(String(e), 500);
      }),
    );
  }
}

/** What the database refuses for integrity: a repeated unique value, a foreign key that points at nothing or a row
 * others still point to, a null in a required column (the validator of the columns refuses that one before the
 * database does). The cases of Spring's DataIntegrityViolationException, which Spring Data REST answers 409. */
function refusedForIntegrity(e: unknown): boolean {
  if (e instanceof ValidationError || e instanceof ForeignKeyConstraintError) return true;
  if (!(e instanceof DatabaseError)) return false;
  // SQLSTATE class 23 (PostgreSQL's code, MySQL's and MariaDB's sqlState); SQLite's constraint error
  const { code, sqlState } = e.original as { code?: string; sqlState?: string };
  return String(sqlState ?? code).startsWith('23') || String(code).startsWith('SQLITE_CONSTRAINT');
}

/** Every error answers Nuclear's body, whatever the framework would write (ADR-synapsis-0013): a Result's error, a
 * guard's refusal, an invalid body or parameter with its reasons, a route that does not exist, what the database
 * refuses for integrity (409 `conflict`), and what nothing
 * handled (a 500 that never says why: the reason may hold what the app must not show). */
type Req = { method: string; url: string; originalUrl?: string; headers: Headers; rawHeaders?: string[] };
type Res = { status(n: number): Res; json(v: unknown): void; setHeader(k: string, v: string): void; end(): void };

@Catch()
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly app?: INestApplication, private readonly guards: readonly Guard[] = []) {}

  catch(e: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Res>();
    // (a test may hand only the response)
    const req = (typeof http.getRequest === 'function' ? http.getRequest<Req>() : undefined) ?? { method: '', url: '', headers: {} };
    if (e instanceof Unreadable) {
      res.status(400).json(errorBody(400, 'invalid', e.reasons));
    } else if (e instanceof InvalidInput) {
      res.status(400).json(errorBody(400, 'invalid', e.errors));
    } else if (e instanceof AppError) {
      res.status(e.status).json(errorBody(e.status, e.message));
    } else if (refusedForIntegrity(e)) {
      // never the database's words: they name a constraint, a column, a value
      res.status(409).json(errorBody(409, 'conflict'));
    } else if (e instanceof HttpException) {
      const status = e.getStatus();
      const said = e.getResponse();
      const text = typeof said === 'string' ? said : String((said as { message?: unknown }).message ?? '');
      if (status === 404 && /^Cannot [A-Z]+ /.test(text)) return this.notFound(req, res);
      const known: Record<number, string> = { 404: 'not found', 405: 'method not allowed' };
      const own = text && !/^Cannot [A-Z]+ /.test(text) ? text : '';
      res.status(status).json(errorBody(status, own || known[status] || 'error'));
    } else {
      logCause(req.method, (req.originalUrl ?? req.url).split('?')[0]!, e);
      res.status(500).json(errorBody(500, 'error'));
    }
  }

  /** No route for the request: a path the app has with other methods answers 405 with them (`Allow`), or 200 with
   * them to OPTIONS, after the app's guards; any other path 404. */
  private notFound(req: Req, res: Res): void {
    const path = req.url.split('?')[0]!;
    const methods = new Set<string>(['OPTIONS']);
    const router = (this.app?.getHttpAdapter().getInstance() as { router?: { stack?: Layer[] } } | undefined)?.router;
    for (const layer of router?.stack ?? []) {
      if (layer.route && layer.match?.(path)) for (const [m, on] of Object.entries(layer.route.methods ?? {})) if (on) methods.add(m.toUpperCase());
    }
    if (methods.size === 1) return void res.status(404).json(errorBody(404, 'not found'));
    const refused = refusal(this.guards, headersOf(req));
    if (refused) return void res.status(refused.status).json(errorBody(refused.status, refused.message));
    if (methods.has('GET')) methods.add('HEAD');
    const allow = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].filter((m) => methods.has(m)).join(', ');
    res.setHeader('Allow', allow);
    if (req.method === 'OPTIONS') return void res.status(200).end();
    res.status(405).json(errorBody(405, 'method not allowed'));
  }
}

type Layer = { route?: { methods?: Record<string, boolean> }; match?: (path: string) => boolean };

/** A parameter of the route or the query as its type, by the platform's rules (the reference, §2.7): blanks
 * around it are ignored, an empty one is not given (the method's default, or nothing), one given twice is refused. */
abstract class ParamPipe<T> implements PipeTransform<unknown, T | Refused | undefined> {
  protected abstract readonly type: string;
  protected abstract parse(text: string): T | undefined;

  transform(value: unknown, at: ArgumentMetadata): T | Refused | undefined {
    const name = at.data ?? '';
    if (value instanceof Refused) return value;
    if (Array.isArray(value)) return new Refused([reason(name, 'type', this.type)]);
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    if (text === '') return undefined;
    if (text.includes('\0')) return new Refused([reason(name, 'invalid')]);
    const parsed = this.parse(text);
    return parsed === undefined ? new Refused([reason(name, 'type', this.type)]) : parsed;
  }
}

/** Why a pipe refused its parameter (or the body): the route refuses them together before it runs. */
export class Refused {
  constructor(
    readonly reasons: Reason[],
    readonly body = false,
  ) {}
}

@Injectable()
export class IntPipe extends ParamPipe<number> {
  protected readonly type = 'a whole number';
  protected parse(text: string): number | undefined {
    if (!/^[+-]?\d+$/.test(text)) return undefined;
    const n = Number(text);
    return n >= INT_MIN && n < INT_MAX ? n : undefined;
  }
}

@Injectable()
export class DoublePipe extends ParamPipe<number> {
  protected readonly type = 'a number';
  protected parse(text: string): number | undefined {
    const n = Number(text);
    return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text) && Number.isFinite(n) ? n : undefined;
  }
}

@Injectable()
export class BoolPipe extends ParamPipe<boolean> {
  protected readonly type = 'true or false';
  protected parse(text: string): boolean | undefined {
    return text === 'true' ? true : text === 'false' ? false : undefined;
  }
}

/** A text parameter of the route or the query (a parameter without another pipe). */
@Injectable()
export class TextPipe extends ParamPipe<string> {
  protected readonly type = 'a text';
  protected parse(text: string): string {
    return text;
  }
}

/** A parameter without a default that is not optional: missing (or empty), it is `required`. */
@Injectable()
export class RequiredPipe implements PipeTransform {
  transform(value: unknown, at: ArgumentMetadata): unknown {
    const empty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    return empty ? new Refused([reason(at.data ?? '', 'required')]) : value;
  }
}

/** The body of a route that takes one: JSON read by the platform's rules (edge.readJson), an object. */
class BodyPipe implements PipeTransform {
  transform(value: unknown, at: ArgumentMetadata): unknown {
    if (at.type !== 'body') return value;
    let read: unknown;
    try {
      read = value instanceof RawBody ? readJson(value.bytes) : value;
    } catch (e) {
      if (e instanceof Unreadable) return new Refused(e.reasons, true);
      throw e;
    }
    if (read === undefined || read === null) return new Refused([reason('', 'required')], true);
    if (typeof read !== 'object' || Array.isArray(read)) return new Refused([reason('', 'type', 'an object')], true);
    return read;
  }
}

/** class-validator for the body only: a parameter of the route or the query is read by its own pipe. */
class BodyValidation extends ValidationPipe {
  override async transform(value: unknown, at: ArgumentMetadata): Promise<unknown> {
    if (at.type !== 'body' || value instanceof Refused) return value;
    try {
      return await super.transform(value, at);
    } catch (e) {
      if (e instanceof InvalidInput) return new Refused([...e.errors], true);
      throw e;
    }
  }
}

/** What every Synapsis app has: the edge of every request (its line in the log, the body's limit and type, CORS),
 * validated bodies (class-validator), Result answers, routes whose order does not matter, matched as written (case
 * and a last `/`), answers that do not name the server, and the contract it was built with. */
export function configureApp(app: INestApplication): INestApplication {
  const config = configOf(app);
  const guards = config?.guards ?? [];
  limits.body = config?.maxBodySize ?? MAX_BODY_SIZE;
  limits.page = config?.maxPageSize ?? MAX_PAGE_SIZE;
  const server = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void; router?: { caseSensitive?: boolean; strict?: boolean } };
  server.set?.('x-powered-by', false);
  server.set?.('etag', false);
  // the router exists already: the routes Nest adds next are matched by its own options
  if (server.router) Object.assign(server.router, { caseSensitive: true, strict: true });
  app.use(edge(config?.origins ?? []));
  if (guards.length) app.useGlobalGuards(new GuardsOf(guards));
  app.useGlobalPipes(
    new BodyPipe(),
    new BodyValidation({ transform: true, whitelist: true, exceptionFactory: (errors) => new InvalidInput(reasonsOf(errors as Invalidity[])) }),
  );
  app.useGlobalInterceptors(new ResultInterceptor());
  app.useGlobalFilters(new ErrorFilter(app, guards));
  fixedRoutesFirst(app);
  serveContract(app, guards);
  for (const c of config?.connections ?? []) c.instrument(app);
  return app;
}

/** The project config of the app; none in a module without it (the runtime's own tests). */
function configOf(app: INestApplication): AppConfig | undefined {
  try {
    return app.get(AppConfig, { strict: false });
  } catch {
    return undefined;
  }
}

type Route = ((...args: unknown[]) => unknown) & { [together]?: true };
const together = Symbol('synapsis.refusedTogether');

/** The route `fn` refusing, before it runs, every parameter its pipes refused (each one's reason, in one answer), or
 * else the body's: the parameters of the path and the query are checked first, then the body. Nest's metadata of
 * the method stays on it. */
function refusedTogether(fn: Route): Route {
  if (fn[together]) return fn;
  const route: Route = function (this: unknown, ...args: unknown[]) {
    const refused = args.filter((a): a is Refused => a instanceof Refused);
    if (refused.length) {
      const params = refused.filter((r) => !r.body);
      throw new InvalidInput((params.length ? params : refused).flatMap((r) => r.reasons));
    }
    return fn.apply(this, args);
  };
  for (const key of Reflect.getMetadataKeys(fn)) Reflect.defineMetadata(key, Reflect.getMetadata(key, fn), route);
  Object.defineProperty(route, 'name', { value: fn.name });
  Object.defineProperty(route, 'length', { value: fn.length });
  route[together] = true;
  return route;
}

/** A fixed segment wins over a parameter whatever the order of a controller's routes (`search` over `:id`): Nest adds
 * the routes in the order of the class's methods, so a method whose path has a parameter earlier is moved later. */
function fixedRoutesFirst(app: INestApplication): void {
  // 'path' is Nest's PATH_METADATA: what @Get, @Post... keep on the method
  const shape = (method: unknown) => String(Reflect.getMetadata('path', method as object)).split('/').filter(Boolean).map((s) => (s.startsWith(':') ? '1' : '0')).join('');
  for (const module of app.get(ModulesContainer).values()) {
    for (const { metatype } of module.controllers.values()) {
      const proto = (metatype as { prototype?: Record<string, unknown> } | null)?.prototype;
      if (!proto) continue;
      const routes = Object.getOwnPropertyNames(proto)
        .map((name) => ({ name, at: Object.getOwnPropertyDescriptor(proto, name)! }))
        .filter(({ name, at }) => name !== 'constructor' && typeof at.value === 'function' && Reflect.hasMetadata('path', at.value as object))
        .map((r) => ({ ...r, shape: shape(r.at.value) }));
      routes.sort((a, b) => (a.shape < b.shape ? -1 : a.shape > b.shape ? 1 : 0));
      for (const { name, at } of routes) {
        delete proto[name];
        Object.defineProperty(proto, name, { ...at, value: refusedTogether(at.value as Route) });
      }
    }
  }
}

/** GET /.nuclear/contract.json and /.nuclear/openapi.json: what the transpiler wrote next to the app (ADR-synapsis-0006), so a
 * client project (`contracts(name = "https://...")`) and the editors' HTTP tools read the API as built. */
function serveContract(app: INestApplication, guards: readonly Guard[]): void {
  const server = app.getHttpAdapter().getInstance() as { get?: (path: string, handler: (req: { headers: Headers; rawHeaders?: string[] }, res: { json(v: unknown): void; status(n: number): { json(v: unknown): void } }) => void) => void };
  if (typeof server.get !== 'function') return;
  // `/openapi.json` is the same document: the API is described once, from the Nuclear, in every dialect
  // (ADR-synapsis-0013); a guarded app does not serve it there, as it serves no documentation page
  const routes = [['contract', '/.nuclear/contract.json'], ['openapi', '/.nuclear/openapi.json'], ...(guards.length ? [] : [['openapi', '/openapi.json']])];
  for (const [name, path] of routes) {
    const file = join('.nuclear', `${name}.json`);
    if (!existsSync(file)) continue;
    server.get(path!, (req, res) => {
      const e = refusal(guards, headersOf(req));
      if (e) return res.status(e.status).json(errorBody(e.status, e.message));
      res.json(JSON.parse(readFileSync(file, 'utf8')));
    });
  }
}
