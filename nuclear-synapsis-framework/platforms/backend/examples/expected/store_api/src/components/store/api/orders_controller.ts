import { Order } from '../data/entities/order.js';
import { NewOrder } from '../domain/models/new_order.js';
import { Paid } from '../domain/models/paid.js';
import { TagList } from '../domain/models/tag_list.js';
import { StoreAppComponent } from '../store_appcomponent.js';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AppError, DoublePipe, IntPipe, RequiredPipe, Result } from 'synapsis-nest';

/** The routes of orders. */
@Controller('orders')
export class OrdersController {
  constructor(private readonly app: StoreAppComponent) {}

  @Get()
  async list(@Query('page', IntPipe) page: number = 1): Promise<Result<AppError, Order[]>> {
    return await this.app.listOrders(page);
  }

  @Get(':id')
  async one(@Param('id', RequiredPipe, IntPipe) id: number): Promise<Result<AppError, Order>> {
    return await this.app.getOrder(id);
  }

  @Post()
  async create(@Body() input: NewOrder): Promise<Result<AppError, Order>> {
    return await this.app.createOrder(input);
  }

  @Put(':id')
  async update(@Param('id', RequiredPipe, IntPipe) id: number, @Body() input: NewOrder): Promise<Result<AppError, Order>> {
    return await this.app.updateOrder(id, input);
  }

  @Delete(':id')
  async remove(@Param('id', RequiredPipe, IntPipe) id: number): Promise<Result<AppError, boolean>> {
    return await this.app.deleteOrder(id);
  }

  @Get(':id/full')
  async fullOrder(@Param('id', RequiredPipe, IntPipe) id: number): Promise<Result<AppError, Order>> {
    return await this.app.fullOrder(id);
  }

  @Get('of/:customerId')
  async ordersOfCustomer(@Param('customerId', RequiredPipe, IntPipe) customerId: number, @Query('minTotal', RequiredPipe, DoublePipe) minTotal: number): Promise<Result<AppError, Order[]>> {
    return await this.app.ordersOfCustomer(customerId, minTotal);
  }

  @Get('unnoted')
  async unnotedOrders(): Promise<Result<AppError, Order[]>> {
    return await this.app.unnotedOrders();
  }

  @Post('checkout')
  async checkout(@Body() input: NewOrder): Promise<Result<AppError, Order>> {
    return await this.app.checkout(input);
  }

  @Post('pay/:customerId')
  async payOrders(@Param('customerId', RequiredPipe, IntPipe) customerId: number): Promise<Result<AppError, Paid>> {
    return await this.app.payOrders(customerId);
  }

  @Put(':id/tags')
  async tagOrder(@Param('id', RequiredPipe, IntPipe) id: number, @Body() input: TagList): Promise<Result<AppError, Order>> {
    return await this.app.tagOrder(id, input);
  }
}
