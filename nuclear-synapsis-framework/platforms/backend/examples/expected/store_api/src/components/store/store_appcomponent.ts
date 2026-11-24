import { Balance } from './data/entities/balance.js';
import { Coupon } from './data/entities/coupon.js';
import { Customer } from './data/entities/customer.js';
import { Order } from './data/entities/order.js';
import { Tag } from './data/entities/tag.js';
import { NewBalance } from './domain/models/new_balance.js';
import { NewCoupons } from './domain/models/new_coupons.js';
import { NewCustomer } from './domain/models/new_customer.js';
import { NewOrder } from './domain/models/new_order.js';
import { NewTag } from './domain/models/new_tag.js';
import { Paid } from './domain/models/paid.js';
import { TagList } from './domain/models/tag_list.js';
import { BalancesAtLeast } from './domain/usecases/balances_at_least.js';
import { Checkout } from './domain/usecases/checkout.js';
import { ClearCoupon } from './domain/usecases/clear_coupon.js';
import { CreateBalance } from './domain/usecases/create_balance.js';
import { CreateCustomer } from './domain/usecases/create_customer.js';
import { CreateOrder } from './domain/usecases/create_order.js';
import { CreateTag } from './domain/usecases/create_tag.js';
import { CustomerOrders } from './domain/usecases/customer_orders.js';
import { DeleteBalance } from './domain/usecases/delete_balance.js';
import { DeleteCustomer } from './domain/usecases/delete_customer.js';
import { DeleteOrder } from './domain/usecases/delete_order.js';
import { Deposit } from './domain/usecases/deposit.js';
import { DraftCustomer } from './domain/usecases/draft_customer.js';
import { FullOrder } from './domain/usecases/full_order.js';
import { GetBalance } from './domain/usecases/get_balance.js';
import { GetCustomer } from './domain/usecases/get_customer.js';
import { GetOrder } from './domain/usecases/get_order.js';
import { GiveCoupons } from './domain/usecases/give_coupons.js';
import { ListBalances } from './domain/usecases/list_balances.js';
import { ListCustomers } from './domain/usecases/list_customers.js';
import { ListOrders } from './domain/usecases/list_orders.js';
import { ListTags } from './domain/usecases/list_tags.js';
import { OrdersOfCustomer } from './domain/usecases/orders_of_customer.js';
import { PageCustomers } from './domain/usecases/page_customers.js';
import { PayOrders } from './domain/usecases/pay_orders.js';
import { SearchCustomers } from './domain/usecases/search_customers.js';
import { TagOrder } from './domain/usecases/tag_order.js';
import { UnnotedOrders } from './domain/usecases/unnoted_orders.js';
import { UpdateBalance } from './domain/usecases/update_balance.js';
import { UpdateCustomer } from './domain/usecases/update_customer.js';
import { UpdateOrder } from './domain/usecases/update_order.js';
import { VipCustomers } from './domain/usecases/vip_customers.js';
import { Injectable } from '@nestjs/common';
import { AppError, Page, Result } from 'synapsis-nest';

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

/** What the rest of the app sees of store: an alias for each of its use cases. */
@Injectable()
export class StoreAppComponent {
  constructor(
    private readonly listCustomersInstance: ListCustomers,
    private readonly getCustomerInstance: GetCustomer,
    private readonly createCustomerInstance: CreateCustomer,
    private readonly updateCustomerInstance: UpdateCustomer,
    private readonly deleteCustomerInstance: DeleteCustomer,
    private readonly listOrdersInstance: ListOrders,
    private readonly getOrderInstance: GetOrder,
    private readonly createOrderInstance: CreateOrder,
    private readonly updateOrderInstance: UpdateOrder,
    private readonly deleteOrderInstance: DeleteOrder,
    private readonly listTagsInstance: ListTags,
    private readonly createTagInstance: CreateTag,
    private readonly pageCustomersInstance: PageCustomers,
    private readonly searchCustomersInstance: SearchCustomers,
    private readonly vipCustomersInstance: VipCustomers,
    private readonly customerOrdersInstance: CustomerOrders,
    private readonly fullOrderInstance: FullOrder,
    private readonly ordersOfCustomerInstance: OrdersOfCustomer,
    private readonly unnotedOrdersInstance: UnnotedOrders,
    private readonly checkoutInstance: Checkout,
    private readonly payOrdersInstance: PayOrders,
    private readonly tagOrderInstance: TagOrder,
    private readonly draftCustomerInstance: DraftCustomer,
    private readonly giveCouponsInstance: GiveCoupons,
    private readonly clearCouponInstance: ClearCoupon,
    private readonly listBalancesInstance: ListBalances,
    private readonly getBalanceInstance: GetBalance,
    private readonly createBalanceInstance: CreateBalance,
    private readonly updateBalanceInstance: UpdateBalance,
    private readonly deleteBalanceInstance: DeleteBalance,
    private readonly balancesAtLeastInstance: BalancesAtLeast,
    private readonly depositInstance: Deposit,
  ) {}

  async listCustomers(page: number): Promise<Result<AppError, Customer[]>> {
    return await this.listCustomersInstance.exec(page);
  }

  async getCustomer(id: number): Promise<Result<AppError, Customer>> {
    return await this.getCustomerInstance.exec(id);
  }

  async createCustomer(input: NewCustomer): Promise<Result<AppError, Customer>> {
    return await this.createCustomerInstance.exec(input);
  }

  async updateCustomer(id: number, input: NewCustomer): Promise<Result<AppError, Customer>> {
    return await this.updateCustomerInstance.exec(id, input);
  }

  async deleteCustomer(id: number): Promise<Result<AppError, boolean>> {
    return await this.deleteCustomerInstance.exec(id);
  }

  async listOrders(page: number): Promise<Result<AppError, Order[]>> {
    return await this.listOrdersInstance.exec(page);
  }

  async getOrder(id: number): Promise<Result<AppError, Order>> {
    return await this.getOrderInstance.exec(id);
  }

  async createOrder(input: NewOrder): Promise<Result<AppError, Order>> {
    return await this.createOrderInstance.exec(input);
  }

  async updateOrder(id: number, input: NewOrder): Promise<Result<AppError, Order>> {
    return await this.updateOrderInstance.exec(id, input);
  }

  async deleteOrder(id: number): Promise<Result<AppError, boolean>> {
    return await this.deleteOrderInstance.exec(id);
  }

  async listTags(page: number): Promise<Result<AppError, Tag[]>> {
    return await this.listTagsInstance.exec(page);
  }

  async createTag(input: NewTag): Promise<Result<AppError, Tag>> {
    return await this.createTagInstance.exec(input);
  }

  async pageCustomers(page: number, size: number): Promise<Result<AppError, Page<Customer>>> {
    return await this.pageCustomersInstance.exec(page, size);
  }

  async searchCustomers(text: string, page: number, size: number): Promise<Result<AppError, Page<Customer>>> {
    return await this.searchCustomersInstance.exec(text, page, size);
  }

  async vipCustomers(credit: number): Promise<Result<AppError, Customer[]>> {
    return await this.vipCustomersInstance.exec(credit);
  }

  async customerOrders(id: number): Promise<Result<AppError, Customer>> {
    return await this.customerOrdersInstance.exec(id);
  }

  async fullOrder(id: number): Promise<Result<AppError, Order>> {
    return await this.fullOrderInstance.exec(id);
  }

  async ordersOfCustomer(customerId: number, minTotal: number): Promise<Result<AppError, Order[]>> {
    return await this.ordersOfCustomerInstance.exec(customerId, minTotal);
  }

  async unnotedOrders(): Promise<Result<AppError, Order[]>> {
    return await this.unnotedOrdersInstance.exec();
  }

  async checkout(input: NewOrder): Promise<Result<AppError, Order>> {
    return await this.checkoutInstance.exec(input);
  }

  async payOrders(customerId: number): Promise<Result<AppError, Paid>> {
    return await this.payOrdersInstance.exec(customerId);
  }

  async tagOrder(id: number, input: TagList): Promise<Result<AppError, Order>> {
    return await this.tagOrderInstance.exec(id, input);
  }

  draftCustomer(email: string): Result<AppError, NewCustomer> {
    return this.draftCustomerInstance.exec(email);
  }

  async giveCoupons(input: NewCoupons): Promise<Result<AppError, Coupon[]>> {
    return await this.giveCouponsInstance.exec(input);
  }

  async clearCoupon(id: number): Promise<Result<AppError, number>> {
    return await this.clearCouponInstance.exec(id);
  }

  async listBalances(page: number): Promise<Result<AppError, Balance[]>> {
    return await this.listBalancesInstance.exec(page);
  }

  async getBalance(id: number): Promise<Result<AppError, Balance>> {
    return await this.getBalanceInstance.exec(id);
  }

  async createBalance(input: NewBalance): Promise<Result<AppError, Balance>> {
    return await this.createBalanceInstance.exec(input);
  }

  async updateBalance(id: number, input: NewBalance): Promise<Result<AppError, Balance>> {
    return await this.updateBalanceInstance.exec(id, input);
  }

  async deleteBalance(id: number): Promise<Result<AppError, boolean>> {
    return await this.deleteBalanceInstance.exec(id);
  }

  async balancesAtLeast(amount: BigDouble): Promise<Result<AppError, Balance[]>> {
    return await this.balancesAtLeastInstance.exec(amount);
  }

  async deposit(id: number, amount: BigDouble): Promise<Result<AppError, Balance>> {
    return await this.depositInstance.exec(id, amount);
  }
}
