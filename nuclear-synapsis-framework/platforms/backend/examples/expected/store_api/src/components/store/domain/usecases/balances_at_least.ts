import { Balance } from '../../data/entities/balance.js';
import { BalanceRepository } from '../../data/repositories/balance_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

// Nuclear's bigdouble: an exact decimal, m × 10^-s (s ≥ 0, no trailing zero in m when s > 0); ADR-lang-0015
class BigDouble {
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

/** What BalanceRepository.atLeast answers, for the rest of store. */
@Injectable()
export class BalancesAtLeast {
  constructor(private readonly repository: BalanceRepository) {}

  async exec(amount: BigDouble): Promise<Result<AppError, Balance[]>> {
    return Ok(await this.repository.atLeast(amount));
  }
}
