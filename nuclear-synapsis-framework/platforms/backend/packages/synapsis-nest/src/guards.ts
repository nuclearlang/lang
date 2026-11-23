// Guards (ADR-synapsis-0007): checks a request passes before its route runs, on every route of the app
// (`AppConfig.guards`) or of one controller (`@controller('x', guards = [...])`), over HTTP and over the app's
// WebSocket. A guard reads only the request's headers: a token in a query parameter would reach the access log. A
// header is read without the blanks around it, and one given twice is not given.
import { CanActivate, ExecutionContext, HttpException, UseGuards } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { AppError, Forbidden, Unauthorized } from './errors.js';

export type Headers = Record<string, string | string[] | undefined>;

/** A check of a request's headers: null lets it through, an AppError refuses it with its status. */
export abstract class Guard {
  abstract check(headers: Headers): AppError | null;
}

/** The value of the header `name`, without the blanks around it; '' when it is not there or is given more than once
 * (as Spring Security refuses several bearer tokens: which one counts would be the server's choice). */
function header(headers: Headers, name: string): string {
  const want = name.toLowerCase();
  const found = Object.entries(headers).filter(([k]) => k.toLowerCase() === want).flatMap(([, v]) => (Array.isArray(v) ? v : v === undefined ? [] : [v]));
  return found.length === 1 ? found[0]!.trim() : '';
}

/** A request's headers with every value it was given (Node joins or drops a header sent twice). */
export function headersOf(req: { headers: Headers; rawHeaders?: string[] }): Headers {
  if (!req.rawHeaders) return req.headers;
  const out: Record<string, string[]> = {};
  for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) (out[req.rawHeaders[i]!.toLowerCase()] ??= []).push(req.rawHeaders[i + 1]!);
  return out;
}

/** The request carries `value` in the header `header` (default `Authorization`, where it is `Bearer <value>`). An
 * empty `value` (an unset environment variable) refuses every request: a guard never opens by mistake. */
export class Token extends Guard {
  readonly value: string;
  readonly header: string;

  constructor(options: { value: string; header?: string }) {
    super();
    this.value = options.value;
    this.header = options.header ?? 'Authorization';
  }

  check(headers: Headers): AppError | null {
    let sent = header(headers, this.header);
    if (this.header.toLowerCase() === 'authorization' && sent.startsWith('Bearer ')) sent = sent.slice('Bearer '.length);
    const a = Buffer.from(sent);
    const b = Buffer.from(this.value);
    if (!this.value || a.length !== b.length || !timingSafeEqual(a, b)) {
      return new Unauthorized(`a valid token in the header '${this.header}' is required`);
    }
    return null;
  }
}

/** Refuses a request with an `Origin` header: what a web page sends, so a local service is not reachable from a page
 * the user opened in a browser. */
export class NoOrigin extends Guard {
  check(headers: Headers): AppError | null {
    // any Origin, once or more, empty or not: a page sent it
    return Object.keys(headers).some((k) => k.toLowerCase() === 'origin') ? new Forbidden('requests from web pages are refused') : null;
  }
}

/** The first guard that refuses the request, in order, or null. */
export function refusal(guards: readonly Guard[], headers: Headers): AppError | null {
  for (const g of guards) {
    const e = g.check(headers);
    if (e) return e;
  }
  return null;
}

/** The Nest guard of a list of guards: a refusal answers its status. */
export class GuardsOf implements CanActivate {
  constructor(private readonly guards: readonly Guard[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Headers; rawHeaders?: string[] }>();
    const e = refusal(this.guards, headersOf(request));
    if (e) throw new HttpException(e.message, e.status);
    return true;
  }
}

/** `@controller('admin', guards = [...])`: every route of the controller passes them. */
export function guardedBy(list: readonly Guard[]): ClassDecorator & MethodDecorator {
  return UseGuards(new GuardsOf(list));
}
