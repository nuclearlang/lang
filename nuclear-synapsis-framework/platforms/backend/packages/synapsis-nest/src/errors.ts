// The errors of a use case: each one is the HTTP status a controller answers with.
export class AppError {
  constructor(
    readonly message: string = 'error',
    readonly status: number = 500,
  ) {}
}

export class Invalid extends AppError {
  constructor(message = 'invalid') {
    super(message, 400);
  }
}

export class Unauthorized extends AppError {
  constructor(message = 'unauthorized') {
    super(message, 401);
  }
}

export class Forbidden extends AppError {
  constructor(message = 'forbidden') {
    super(message, 403);
  }
}

export class NotFound extends AppError {
  constructor(message = 'not found') {
    super(message, 404);
  }
}

export class Conflict extends AppError {
  constructor(message = 'conflict') {
    super(message, 409);
  }
}

// ---------- the body of an error: Nuclear's, the same in every dialect (ADR-synapsis-0013) ----------

/** Why a field of a body or a parameter is refused: `field` (a path: `items.0.name`; empty for the body itself),
 * `rule` (the name of the validation in Nuclear) and `message`. */
export interface Reason {
  field: string;
  rule: string;
  message: string;
}

/** What an error answers: its status, its message and, for an invalid body or parameter, one reason per field. */
export interface ErrorBody {
  status: number;
  message: string;
  errors?: Reason[];
}

// one reason per field: the first of these rules it breaks
const RULES = ['required', 'type', 'minLength', 'maxLength', 'min', 'max', 'pattern', 'email', 'url', 'json', 'invalid'];

/** A reason with its message, written here so every dialect says the same. */
export function reason(field: string, rule: string, value?: unknown): Reason {
  const name = field || 'the body';
  const texts: Record<string, string> = {
    required: `${name} is required`,
    type: `${name} must be ${String(value)}`,
    minLength: `${name} must have at least ${String(value)} characters`,
    maxLength: `${name} must have at most ${String(value)} characters`,
    min: `${name} must be at least ${String(value)}`,
    max: `${name} must be at most ${String(value)}`,
    pattern: `${name} does not match its pattern`,
    email: `${name} must be an e-mail address`,
    url: `${name} must be a URL`,
    json: 'the body is not valid JSON',
  };
  return { field, rule: RULES.includes(rule) ? rule : 'invalid', message: texts[rule] ?? `${name} is not valid` };
}

/** The body of an error; `errors` keeps one reason per field, in the order of the fields' names. */
export function errorBody(status: number, message: string, errors?: readonly Reason[]): ErrorBody {
  if (!errors) return { status, message };
  const first = new Map<string, Reason>();
  for (const e of errors) {
    const kept = first.get(e.field);
    if (!kept || RULES.indexOf(e.rule) < RULES.indexOf(kept.rule)) first.set(e.field, e);
  }
  const fields = [...first.keys()].sort();
  return { status, message, errors: fields.map((f) => first.get(f)!) };
}

/** An invalid body or parameter: a 400 that carries its reasons. */
export class InvalidInput extends Invalid {
  constructor(readonly errors: readonly Reason[]) {
    super('invalid');
  }
}

// the validator's own names (class-validator's constraints) → Nuclear's rule, with the type it asks for
const CONSTRAINTS: Record<string, [string, string?]> = {
  isDefined: ['required'],
  isNotEmpty: ['required'],
  isString: ['type', 'a text'],
  isInt: ['type', 'a whole number'],
  isBigInt: ['type', 'a whole number in a text'],
  isBigDouble: ['type', 'a decimal number in a text'],
  isNumber: ['type', 'a number'],
  isBoolean: ['type', 'true or false'],
  isArray: ['type', 'a list'],
  isObject: ['type', 'an object'],
  nestedValidation: ['type', 'an object'],
  isDate: ['type', 'a date and time'],
  isDateString: ['type', 'a date and time'],
  isIso8601: ['type', 'a date and time'],
  minLength: ['minLength'],
  maxLength: ['maxLength'],
  min: ['min'],
  max: ['max'],
  matches: ['pattern'],
  isEmail: ['email'],
  isUrl: ['url'],
};

// a list checked item by item (`{ each: true }`): what an item of each type is, so the reason names the item
const ITEM: Record<string, (v: unknown) => boolean> = {
  isString: (v) => typeof v === 'string',
  isInt: (v) => typeof v === 'number' && Number.isInteger(v) && v >= -(2 ** 63) && v < 2 ** 63,
  isNumber: (v) => typeof v === 'number' && Number.isFinite(v),
  isBoolean: (v) => typeof v === 'boolean',
  isDate: (v) => v instanceof Date && !Number.isNaN(v.getTime()),
  isBigInt: (v) => typeof v === 'bigint',
  isBigDouble: (v) => typeof v === 'object' && v !== null && typeof (v as { m?: unknown }).m === 'bigint',
};

/** What the validator reports for one property (class-validator's `ValidationError`). */
export interface Invalidity {
  property: string;
  value?: unknown;
  constraints?: Record<string, string>;
  children?: Invalidity[];
}

/** The reasons of the validator's errors, in Nuclear's words. */
export function reasonsOf(errors: readonly Invalidity[], prefix = ''): Reason[] {
  const out: Reason[] = [];
  for (const e of errors) {
    const field = prefix ? `${prefix}.${e.property}` : e.property;
    for (const [name, said] of Object.entries(e.constraints ?? {})) {
      // a value that is not there breaks every rule of its field: the reason is that it is required
      if (e.value === undefined || e.value === null) {
        out.push(reason(field, 'required'));
        continue;
      }
      // an empty text under @required is not given, as a missing value is: `required` in every dialect
      if (name === 'isNotEmpty') {
        out.push(reason(field, 'required'));
        continue;
      }
      const [rule, type] = CONSTRAINTS[name] ?? ['invalid'];
      // the validator names the list, not the item that broke the type: each one is named here (`labels.0`)
      // (a list given where one value goes has no item to name: the field itself is the reason)
      if (Array.isArray(e.value) && ITEM[name]) {
        const items = e.value.flatMap((v: unknown, i) =>
          v === undefined || v === null ? [reason(`${field}.${i}`, 'required')] : ITEM[name](v) ? [] : [reason(`${field}.${i}`, rule, type)],
        );
        if (items.length) {
          out.push(...items);
          continue;
        }
      }
      // the limit of a rule is the number its message names (`must be longer than or equal to 3 characters`)
      const limit = /-?\d+(\.\d+)?/.exec(said)?.[0];
      out.push(reason(field, rule, type ?? limit));
    }
    if (e.children?.length) out.push(...reasonsOf(e.children, field));
  }
  return out;
}
