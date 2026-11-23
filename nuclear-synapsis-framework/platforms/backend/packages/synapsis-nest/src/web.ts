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
import { AppError, InvalidInput, Invalidity, errorBody, reason, reasonsOf } from './errors.js';
import { Guard, GuardsOf, Headers, refusal } from './guards.js';
import { Result } from './result.js';

@Injectable()
export class ResultInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (!(value instanceof Result)) return value;
        const r = value as Result<unknown, unknown>;
        if (r.isOk) return r.value;
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
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<{ status(n: number): { json(v: unknown): void } }>();
    if (e instanceof InvalidInput) {
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
      // a body that is not JSON is refused by the framework before any validation
      if (status === 400 && /JSON/i.test(text)) return res.status(400).json(errorBody(400, 'invalid', [reason('', 'json')]));
      const known: Record<number, string> = { 404: 'not found', 405: 'method not allowed' };
      const own = text && !/^Cannot [A-Z]+ /.test(text) ? text : '';
      res.status(status).json(errorBody(status, own || known[status] || 'error'));
    } else {
      res.status(500).json(errorBody(500, 'error'));
    }
  }
}

/** A route or query parameter that is a number or a boolean: its value, or the reason it is refused. A parameter
 * that is not given passes (a required one is the route's). */
abstract class ParamPipe<T> implements PipeTransform<unknown, T | undefined> {
  protected abstract readonly type: string;
  protected abstract parse(text: string): T | undefined;

  transform(value: unknown, at: ArgumentMetadata): T | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = this.parse(String(value));
    if (parsed === undefined) throw new InvalidInput([reason(at.data ?? '', 'type', this.type)]);
    return parsed;
  }
}

@Injectable()
export class IntPipe extends ParamPipe<number> {
  protected readonly type = 'a whole number';
  protected parse(text: string): number | undefined {
    return /^[+-]?\d+$/.test(text.trim()) ? Number.parseInt(text, 10) : undefined;
  }
}

@Injectable()
export class DoublePipe extends ParamPipe<number> {
  protected readonly type = 'a number';
  protected parse(text: string): number | undefined {
    const n = Number(text);
    return text.trim() !== '' && Number.isFinite(n) ? n : undefined;
  }
}

@Injectable()
export class BoolPipe extends ParamPipe<boolean> {
  protected readonly type = 'true or false';
  protected parse(text: string): boolean | undefined {
    return text === 'true' ? true : text === 'false' ? false : undefined;
  }
}

/** What every Synapsis app has: validated bodies (class-validator), Result answers, routes whose order does not
 * matter and the contract it was built with. */
export function configureApp(app: INestApplication): INestApplication {
  const config = configOf(app);
  const guards = config?.guards ?? [];
  if (guards.length) app.useGlobalGuards(new GuardsOf(guards));
  if (config?.origins?.length) app.enableCors({ origin: [...config.origins] });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, exceptionFactory: (errors) => new InvalidInput(reasonsOf(errors as Invalidity[])) }),
  );
  app.useGlobalInterceptors(new ResultInterceptor());
  app.useGlobalFilters(new ErrorFilter());
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
        .filter(({ at }) => typeof at.value === 'function' && Reflect.hasMetadata('path', at.value as object))
        .map((r) => ({ ...r, shape: shape(r.at.value) }));
      routes.sort((a, b) => (a.shape < b.shape ? -1 : a.shape > b.shape ? 1 : 0));
      for (const { name, at } of routes) {
        delete proto[name];
        Object.defineProperty(proto, name, at);
      }
    }
  }
}

/** GET /.nuclear/contract.json and /.nuclear/openapi.json: what the transpiler wrote next to the app (ADR-synapsis-0006), so a
 * client project (`contracts(name = "https://...")`) and the editors' HTTP tools read the API as built. */
function serveContract(app: INestApplication, guards: readonly Guard[]): void {
  const server = app.getHttpAdapter().getInstance() as { get?: (path: string, handler: (req: { headers: Headers }, res: { json(v: unknown): void; status(n: number): { json(v: unknown): void } }) => void) => void };
  if (typeof server.get !== 'function') return;
  // `/openapi.json` is the same document: the API is described once, from the Nuclear, in every dialect
  // (ADR-synapsis-0013); a guarded app does not serve it there, as it serves no documentation page
  const routes = [['contract', '/.nuclear/contract.json'], ['openapi', '/.nuclear/openapi.json'], ...(guards.length ? [] : [['openapi', '/openapi.json']])];
  for (const [name, path] of routes) {
    const file = join('.nuclear', `${name}.json`);
    if (!existsSync(file)) continue;
    server.get(path!, (req, res) => {
      const e = refusal(guards, req.headers);
      if (e) return res.status(e.status).json(errorBody(e.status, e.message));
      res.json(JSON.parse(readFileSync(file, 'utf8')));
    });
  }
}
