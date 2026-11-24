// The exact numbers of Nuclear (`bigint`, `bigdouble`; ADR-lang-0015) in the JSON of an app, the backend's rule: an
// exact number travels as a JSON text, the language's `toString()` both ways. A `bigint` is read with the rule of
// `text.toBigInt()` (an optional sign and digits), a `bigdouble` with `text.toBigDouble()` (also decimals and an
// exponent); blanks around it are ignored. A JSON number, another text or a value of more than MAX_DIGITS digits is a
// decoding error: a thrown TypeError, as the mobile platform throws its FormatException.

/** The most digits an exact number of an answer has, written without an exponent (the backend's limit). */
export const MAX_DIGITS = 1000;

const BIGINT = /^[+-]?[0-9]+$/;
const BIGDOUBLE = /^[+-]?([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/;

/** The text of an exact number of a JSON answer, checked: what `BigInt(...)` or the dialect's decimal reads. */
export function exactText(json: unknown, type: 'bigint' | 'bigdouble'): string {
  if (typeof json !== 'string') throw new TypeError(`a ${type} travels as a JSON text, not ${String(json)}`);
  const t = json.trim();
  if (!(type === 'bigint' ? fitsBigInt(t) : fitsBigDouble(t))) throw new TypeError(`'${json}' is not the text of a ${type}`);
  return t;
}

function fitsBigInt(t: string): boolean {
  return BIGINT.test(t) && t.replace(/^[+-]/, '').length <= MAX_DIGITS;
}

function fitsBigDouble(t: string): boolean {
  const m = t.length > 2 * MAX_DIGITS ? null : BIGDOUBLE.exec(t);
  if (m === null) return false;
  const whole = m[1]!;
  const fraction = m[2] ?? '';
  const exponent = m[3] ?? '0';
  // an exponent of more than 6 digits writes more than MAX_DIGITS digits (`1e999999999`)
  if (exponent.replace(/^[+-]/, '').length > 6) return false;
  const digits = `${whole}${fraction}`.replace(/^0+(?=.)/, '').length;
  const e = Number(exponent) - fraction.length;
  return (e >= 0 ? digits + e : Math.max(digits, -e + 1)) <= MAX_DIGITS;
}

/** `JSON.stringify`'s replacer of a request body: a model as its `toJson()` (its JSON names, its exact fields as
 * texts), a `bigint` as its text. */
export function wire(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value !== null && typeof value === 'object') {
    const toJson = (value as { toJson?: unknown }).toJson;
    if (typeof toJson === 'function' && toJson.length === 0) return (toJson as () => unknown).call(value);
  }
  return value;
}
