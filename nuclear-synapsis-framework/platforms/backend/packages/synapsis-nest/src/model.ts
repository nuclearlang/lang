// The models of an app: what a field of a model checks beyond its validator's own decorators, and the check of a
// model built in code. A value's JSON type is its field's (the platform's reference, §2.3): nothing converts.
import { Transform } from 'class-transformer';
import { IsDate, validateSync } from 'class-validator';
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
