// The models of an app: what a field of a model checks beyond its validator's own decorators, and the check of a
// model built in code. A value's JSON type is its field's (the platform's reference, §2.3): nothing converts.
import { Transform } from 'class-transformer';
import { IsDate, ValidateBy, ValidationOptions, ValidationTypes, getMetadataStorage, validateSync } from 'class-validator';
import { Model as Row } from 'sequelize';
import { INT_MAX, INT_MIN } from './edge.js';
import { Invalidity, Reason, errorBody, reasonsOf } from './errors.js';

/** A `DateTime` field of a model: a text in JSON, read as a Date; a value of another JSON type is refused, and so is
 * a text that is not a date. */
export function IsDateTime(options: { each?: boolean } = {}): PropertyDecorator {
  const read = (v: unknown): unknown => (typeof v === 'string' ? new Date(v) : v);
  return (target, key) => {
    // the transformer has already made a Date of whatever came (a number too): the value as it came is read again
    Transform(({ obj, key: k }) => {
      const v = (obj as Record<string, unknown>)[k];
      return Array.isArray(v) ? v.map(read) : read(v);
    })(target, key);
    IsDate(options)(target, key);
  };
}

/** A whole number within 64 bits (an `int` of the platform, the reference §2.3): beyond it, a number is not of the
 * type. Its name is the validator's `isInt`, so its reason is the type's. */
export function isWhole(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= INT_MIN && v < INT_MAX;
}

export function IsWhole(options: ValidationOptions = {}): PropertyDecorator {
  return ValidateBy({ name: 'isInt', validator: { validate: (v) => isWhole(v), defaultMessage: () => 'must be a whole number' } }, options);
}

/** A model built in code that breaks its own rules: what its constructor throws. Nothing handles it by itself, so a
 * use case that lets it go answers 500 (the request's body is checked before, and answers 400). */
export class InvalidModel extends Error {
  constructor(
    model: string,
    readonly errors: readonly Reason[],
  ) {
    super(`${model} is not valid: ${errors.map((e) => e.message).join('; ')}`);
  }
}

/** Checks a model its constructor was given values for (`NewCustomer(email = "nope")`), as every dialect does. A
 * request's body is not built this way: the validation of the request checks it, once. */
export function checkModel(model: object): void {
  // a model without a rule has nothing to check (the validator would refuse it as unknown)
  const errors = validateSync(model, { forbidUnknownValues: false });
  if (errors.length) throw new InvalidModel(model.constructor.name, errorBody(500, '', reasonsOf(errors as Invalidity[])).errors ?? []);
}

const optionals = new Map<Function, string[]>();

/** The optional fields of a model's class: those its validator lets be empty (`IsOptional`, which the dialect writes
 * on every `T?` field). Read once per class. */
function optionalOf(model: Function): string[] {
  let names = optionals.get(model);
  if (!names) {
    const all = getMetadataStorage().getTargetValidationMetadatas(model, '', true, false);
    names = [...new Set(all.filter((m) => m.type === ValidationTypes.CONDITIONAL_VALIDATION).map((m) => m.propertyName))];
    optionals.set(model, names);
  }
  return names;
}

/** `value` as an answer: an optional field of a model left empty is `null`, never absent, as in every dialect (the
 * platform's reference, §2.3), in a model, a model inside it, the items of a list and of a page. A row of the
 * database is already its columns with `null` and is not walked; what needs no change is answered as it is. */
export function answerOf(value: unknown): unknown {
  if (Array.isArray(value)) {
    let out: unknown[] | undefined;
    value.forEach((v, i) => {
      const a = answerOf(v);
      if (a !== v) (out ??= [...value])[i] = a;
    });
    return out ?? value;
  }
  if (value === null || typeof value !== 'object' || value instanceof Date || value instanceof Row) return value;
  const fields = value as Record<string, unknown>;
  let out: Record<string, unknown> | undefined;
  for (const name of optionalOf(value.constructor)) if (fields[name] === undefined) (out ??= { ...fields })[name] = null;
  for (const [name, v] of Object.entries(fields)) {
    const a = answerOf(v);
    if (a !== v) (out ??= { ...fields })[name] = a;
  }
  return out ?? value;
}
