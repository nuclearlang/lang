// The exact numbers of Nuclear (ADR-lang-0015) on the backend (the platform's reference, §2.1 and §2.3), the same as
// synapsis.exact of the Python runtime. BigDouble is the class the dialect writes in each file that uses the type
// (nuclearlang/dialects/typescript/templates/bigdouble.tpl, the same members, kept the same by test/exact.test.ts):
// what the runtime reads is one of it, and it takes one of any file.
import { Transform } from 'class-transformer';
import { ValidateBy, type ValidationOptions } from 'class-validator';

export class BigDouble {
  constructor(readonly m: bigint, readonly s: number) {}

  static make(m: bigint, s: number): BigDouble {
    if (s < 0) return new BigDouble(m * 10n ** BigInt(-s), 0);
    while (s > 0 && m % 10n === 0n) {
      m /= 10n;
      s--;
    }
    return new BigDouble(m, s);
  }

  static tryParse(text: string): BigDouble | null {
    const t = /^([+-]?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(text.trim());
    if (t === null) return null;
    const decimals = t[3] ?? '';
    const m = BigInt(t[2]! + decimals);
    return BigDouble.make(t[1] === '-' ? -m : m, decimals.length - Number(t[4] ?? '0'));
  }

  static of(text: string): BigDouble {
    const d = BigDouble.tryParse(text);
    if (d === null) throw new Error(`'${text}' is not a decimal number`);
    return d;
  }

  static from(n: number | bigint): BigDouble {
    if (typeof n === 'bigint') return new BigDouble(n, 0);
    if (!Number.isFinite(n)) throw new RangeError(`${n} is not a finite number`);
    return BigDouble.of(String(n));
  }

  static align(a: BigDouble, b: BigDouble): [bigint, bigint, number] {
    const s = Math.max(a.s, b.s);
    return [a.m * 10n ** BigInt(s - a.s), b.m * 10n ** BigInt(s - b.s), s];
  }

  plus(o: BigDouble): BigDouble {
    const [a, b, s] = BigDouble.align(this, o);
    return BigDouble.make(a + b, s);
  }

  minus(o: BigDouble): BigDouble {
    const [a, b, s] = BigDouble.align(this, o);
    return BigDouble.make(a - b, s);
  }

  times(o: BigDouble): BigDouble {
    return BigDouble.make(this.m * o.m, this.s + o.s);
  }

  // rounded half away from zero to max(20, the decimals of each side) decimals
  div(o: BigDouble): BigDouble {
    if (o.m === 0n) throw new RangeError('Division by zero');
    const s = Math.max(20, this.s, o.s);
    let n = this.m * 10n ** BigInt(o.s + s - this.s);
    let d = o.m;
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const neg = n < 0n;
    if (neg) n = -n;
    let q = n / d;
    if ((n % d) * 2n >= d) q += 1n;
    return BigDouble.make(neg ? -q : q, s);
  }

  // the remainder of the quotient toward zero: the dividend's sign
  rem(o: BigDouble): BigDouble {
    if (o.m === 0n) throw new RangeError('Division by zero');
    const [a, b, s] = BigDouble.align(this, o);
    return BigDouble.make(a % b, s);
  }

  idiv(o: BigDouble): bigint {
    if (o.m === 0n) throw new RangeError('Division by zero');
    const [a, b] = BigDouble.align(this, o);
    return a / b;
  }

  pow(n: number): BigDouble {
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`the exponent ${n} is not a whole number >= 0`);
    return BigDouble.make(this.m ** BigInt(n), this.s * n);
  }

  neg(): BigDouble {
    return new BigDouble(-this.m, this.s);
  }

  abs(): BigDouble {
    return this.m < 0n ? this.neg() : this;
  }

  sign(): number {
    return this.m > 0n ? 1 : this.m < 0n ? -1 : 0;
  }

  cmp(o: BigDouble): number {
    const [a, b] = BigDouble.align(this, o);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  eq(o: BigDouble): boolean {
    return this.m === o.m && this.s === o.s;
  }

  // half away from zero
  roundTo(digits: number): BigDouble {
    if (digits >= this.s) return this;
    const unit = 10n ** BigInt(this.s - digits);
    let q = this.m / unit;
    const r = this.m % unit;
    if ((r < 0n ? -r : r) * 2n >= unit) q += this.m < 0n ? -1n : 1n;
    return BigDouble.make(q, digits);
  }

  round(): bigint {
    return this.roundTo(0).m;
  }

  truncate(): bigint {
    return this.m / 10n ** BigInt(this.s);
  }

  floor(): bigint {
    const q = this.truncate();
    return this.m < 0n && BigDouble.make(q, 0).cmp(this) !== 0 ? q - 1n : q;
  }

  ceil(): bigint {
    const q = this.truncate();
    return this.m > 0n && BigDouble.make(q, 0).cmp(this) !== 0 ? q + 1n : q;
  }

  toBigInt(): bigint {
    return this.truncate();
  }

  toNumber(): number {
    return Number(this.toString());
  }

  toFixed(digits: number): string {
    const v = this.roundTo(digits);
    const neg = v.m < 0n;
    const a = ((neg ? -v.m : v.m).toString() + '0'.repeat(digits - v.s)).padStart(digits + 1, '0');
    const text = digits === 0 ? a : `${a.slice(0, a.length - digits)}.${a.slice(a.length - digits)}`;
    return neg ? `-${text}` : text;
  }

  // the shortest exact text with at least one decimal: 0.3, 2.0, -1.25
  toString(): string {
    return this.toFixed(Math.max(this.s, 1));
  }

  toJSON(): string {
    return this.toString();
  }
}

/** An exact decimal of any file: the generated code writes the class in each file that uses it (the same members). */
export type Decimalish = { readonly m: bigint; readonly s: number };

export function isBigDouble(v: unknown): v is BigDouble {
  return typeof v === 'object' && v !== null && typeof (v as Decimalish).m === 'bigint' && typeof (v as Decimalish).s === 'number';
}

/** A `bigint` column: the database's BIGINT. */
export const BIGINT_MIN = -(2n ** 63n);
export const BIGINT_MAX = 2n ** 63n - 1n;
/** The most digits an exact number of a request has, written without an exponent: past it, not of the type. */
export const MAX_DIGITS = 1000;
/** A `bigdouble` column without `precision` and `scale`; the most every database takes (MySQL's and MariaDB's). */
export const PRECISION = 30;
export const SCALE = 10;
export const MAX_PRECISION = 65;
export const MAX_SCALE = 30;

/** `text.toBigInt()`: the whole number of `text`, or null; also null past MAX_DIGITS digits. */
export function parseBigInt(text: string): bigint | null {
  const t = text.trim();
  if (t.replace(/^[+-]/, '').length > MAX_DIGITS || !/^[+-]?[0-9]+$/.test(t)) return null;
  return BigInt(t);
}

/** `text.toBigDouble()`: the exact decimal of `text`, or null; also null past MAX_DIGITS digits (counted before the
 * value is made: `1e999999999` would be a billion digits). */
export function parseBigDouble(text: string): BigDouble | null {
  const t = text.trim();
  const parts = /^[+-]?([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(t);
  if (t.length > 2 * MAX_DIGITS || !parts) return null;
  const digits = (parts[1]! + (parts[2] ?? '')).replace(/^0+(?=.)/, '');
  const exponent = Number(parts[3] ?? '0') - (parts[2] ?? '').length;
  const plain = exponent >= 0 ? digits.length + exponent : Math.max(digits.length, -exponent + 1);
  return plain <= MAX_DIGITS ? BigDouble.tryParse(t) : null;
}

/** Whether a `NUMERIC(precision, scale)` holds `d` exactly: at most `scale` decimals and `precision - scale` digits
 * before the point (the databases would round the decimals away). */
export function fitsBigDouble(d: Decimalish, precision: number, scale: number): boolean {
  const v = BigDouble.make(d.m, d.s);
  if (v.s > scale) return false;
  const whole = (v.m < 0n ? -v.m : v.m) / 10n ** BigInt(v.s);
  return whole === 0n || whole.toString().length <= precision - scale;
}

/** The text a column keeps of an exact value: a `bigint`'s digits; a `bigdouble` with `scale` decimals (more when the
 * value has more: a value compared, never written, as it is). Of equal values the text is equal, and of two values
 * with digits of the same length before the point, the text sorts as the value. */
export function columnText(value: bigint | Decimalish, scale?: number): string {
  if (typeof value === 'bigint') return value.toString();
  const d = BigDouble.make(value.m, value.s);
  return d.toFixed(Math.max(scale ?? 0, d.s));
}

/** An exact value as the database gives it back (a text, a number within 2^53, a bigint of a driver). */
function readBigInt(v: unknown): bigint | null {
  return v === null || v === undefined ? null : BigInt(String(v));
}

function readBigDouble(v: unknown): BigDouble | null {
  return v === null || v === undefined ? null : isBigDouble(v) ? v : BigDouble.of(String(v));
}

/** The options of an exact column of an entity (`@Column({ type: DataType.DECIMAL(30, 10), ...exactColumn('price',
 * 30, 10) })`): the value is read back as the exact number (a `bigint`, a BigDouble) and kept as its text with the
 * column's decimals (columnText). Without `precision` and `scale`, a `bigint`. */
export function exactColumn(name: string, precision?: number, scale?: number): { get(this: Row): unknown; set(this: Row, v: unknown): void } {
  const decimal = scale !== undefined;
  const whole = (n: unknown, low: number, high: number): boolean => Number.isInteger(n) && (n as number) >= low && (n as number) <= high;
  if (decimal && !(whole(precision, 1, MAX_PRECISION) && whole(scale, 0, Math.min(MAX_SCALE, precision!)))) {
    throw new Error(
      `a bigdouble column has a precision from 1 to ${MAX_PRECISION} and a scale from 0 to ${MAX_SCALE}, at most the precision (precision = ${precision}, scale = ${scale})`,
    );
  }
  return {
    get(this: Row): unknown {
      const v = this.getDataValue(name);
      return decimal ? readBigDouble(v) : readBigInt(v);
    },
    set(this: Row, v: unknown): void {
      this.setDataValue(name, v === null || v === undefined ? v : exactText(v as bigint | Decimalish, scale));
    },
  };
}

/** The text an exact value is kept as (`defaultValue: exactText(BigDouble.of('1.5'), 10)`). */
export function exactText(v: bigint | Decimalish, scale?: number): string {
  return columnText(typeof v === 'bigint' || isBigDouble(v) ? v : (BigInt(String(v)) as bigint), scale);
}

type Row = { getDataValue(name: string): unknown; setDataValue(name: string, v: unknown): void };

/** A `bigint` field of a model: a JSON text read as `text.toBigInt()` reads it; a JSON number, another text or a
 * value past MAX_DIGITS digits is refused (its reason is the type's). A value of the program is a bigint. */
export function IsBigInt(options: ValidationOptions = {}): PropertyDecorator {
  return exact((v) => (typeof v === 'string' ? (parseBigInt(v) ?? v) : v), (v) => typeof v === 'bigint', 'isBigInt', options);
}

/** A `bigdouble` field of a model: a JSON text read as `text.toBigDouble()` reads it. */
export function IsBigDouble(options: ValidationOptions = {}): PropertyDecorator {
  return exact((v) => (typeof v === 'string' ? (parseBigDouble(v) ?? v) : v), isBigDouble, 'isBigDouble', options);
}

function exact(read: (v: unknown) => unknown, is: (v: unknown) => boolean, name: string, options: ValidationOptions): PropertyDecorator {
  return (target, key) => {
    // the value as it came: the transformer would have made a number of it already
    Transform(({ obj, key: k }) => {
      const v = (obj as Record<string, unknown>)[k];
      return Array.isArray(v) ? v.map(read) : read(v);
    })(target, key);
    ValidateBy({ name, validator: { validate: (v) => is(v), defaultMessage: () => 'must be an exact number in a text' } }, options)(target, key);
  };
}

/** The value of `v` for a comparison: an exact number of any file, as one number. */
function compareExact(v: unknown, bound: bigint | Decimalish): number | null {
  if (typeof bound === 'bigint') return typeof v === 'bigint' ? (v < bound ? -1 : v > bound ? 1 : 0) : null;
  return isBigDouble(v) ? BigDouble.make(v.m, v.s).cmp(BigDouble.make(bound.m, bound.s)) : null;
}

const shown = (b: bigint | Decimalish): string => (typeof b === 'bigint' ? b.toString() : BigDouble.make(b.m, b.s).toString());

/** `@min(n)` of an exact field: the value compared exactly (its reason is `min`, with the bound as Nuclear writes it). */
export function MinExact(bound: bigint | Decimalish, options: ValidationOptions = {}): PropertyDecorator {
  return ValidateBy(
    { name: 'min', validator: { validate: (v) => (compareExact(v, bound) ?? -1) >= 0, defaultMessage: () => `must not be less than ${shown(bound)}` } },
    options,
  );
}

/** `@max(n)` of an exact field. */
export function MaxExact(bound: bigint | Decimalish, options: ValidationOptions = {}): PropertyDecorator {
  return ValidateBy(
    { name: 'max', validator: { validate: (v) => (compareExact(v, bound) ?? 1) <= 0, defaultMessage: () => `must not be greater than ${shown(bound)}` } },
    options,
  );
}
