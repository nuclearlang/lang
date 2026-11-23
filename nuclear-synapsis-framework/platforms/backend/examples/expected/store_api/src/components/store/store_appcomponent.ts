import { Coupon } from './data/entities/coupon.js';
import { Customer } from './data/entities/customer.js';
import { Order } from './data/entities/order.js';
import { Tag } from './data/entities/tag.js';
import { NewCoupons } from './domain/models/new_coupons.js';
import { NewCustomer } from './domain/models/new_customer.js';
import { NewOrder } from './domain/models/new_order.js';
import { NewTag } from './domain/models/new_tag.js';
import { Paid } from './domain/models/paid.js';
import { TagList } from './domain/models/tag_list.js';
import { Checkout } from './domain/usecases/checkout.js';
import { ClearCoupon } from './domain/usecases/clear_coupon.js';
import { CreateCustomer } from './domain/usecases/create_customer.js';
import { CreateOrder } from './domain/usecases/create_order.js';
import { CreateTag } from './domain/usecases/create_tag.js';
import { CustomerOrders } from './domain/usecases/customer_orders.js';
import { DeleteCustomer } from './domain/usecases/delete_customer.js';
import { DeleteOrder } from './domain/usecases/delete_order.js';
import { DraftCustomer } from './domain/usecases/draft_customer.js';
import { FullOrder } from './domain/usecases/full_order.js';
import { GetCustomer } from './domain/usecases/get_customer.js';
import { GetOrder } from './domain/usecases/get_order.js';
import { GiveCoupons } from './domain/usecases/give_coupons.js';
import { ListCustomers } from './domain/usecases/list_customers.js';
import { ListOrders } from './domain/usecases/list_orders.js';
import { ListTags } from './domain/usecases/list_tags.js';
import { OrdersOfCustomer } from './domain/usecases/orders_of_customer.js';
import { PageCustomers } from './domain/usecases/page_customers.js';
import { PayOrders } from './domain/usecases/pay_orders.js';
import { SearchCustomers } from './domain/usecases/search_customers.js';
import { TagOrder } from './domain/usecases/tag_order.js';
import { UnnotedOrders } from './domain/usecases/unnoted_orders.js';
import { UpdateCustomer } from './domain/usecases/update_customer.js';
import { UpdateOrder } from './domain/usecases/update_order.js';
import { VipCustomers } from './domain/usecases/vip_customers.js';
import { Injectable } from '@nestjs/common';
import { AppError, Page, Result } from 'synapsis-nest';

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
}
