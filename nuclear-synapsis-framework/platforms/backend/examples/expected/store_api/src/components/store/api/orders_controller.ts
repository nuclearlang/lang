import { Order } from '../data/entities/order.js';
import { NewOrder } from '../domain/models/new_order.js';
import { Paid } from '../domain/models/paid.js';
import { TagList } from '../domain/models/tag_list.js';
import { StoreAppComponent } from '../store_appcomponent.js';
import { Body, Controller, Delete, Get, Param, ParseFloatPipe, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { AppError, Result } from 'synapsis-nest';

/** The routes of orders. */
@Controller('orders')
export class OrdersController {
  constructor(private readonly app: StoreAppComponent) {}

  @Get()
  async list(@Query('page', new ParseIntPipe({ optional: true })) page: number): Promise<Result<AppError, Order[]>> {
    return await this.app.listOrders(page);
  }

  @Get(':id')
  async one(@Param('id', ParseIntPipe) id: number): Promise<Result<AppError, Order>> {
    return await this.app.getOrder(id);
  }

  @Post()
  async create(@Body() input: NewOrder): Promise<Result<AppError, Order>> {
    return await this.app.createOrder(input);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: NewOrder): Promise<Result<AppError, Order>> {
    return await this.app.updateOrder(id, input);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<Result<AppError, boolean>> {
    return await this.app.deleteOrder(id);
  }

  @Get(':id/full')
  async fullOrder(@Param('id', ParseIntPipe) id: number): Promise<Result<AppError, Order>> {
    return await this.app.fullOrder(id);
  }

  @Get('of/:customerId')
  async ordersOfCustomer(@Param('customerId', ParseIntPipe) customerId: number, @Query('minTotal', new ParseFloatPipe({ optional: true })) minTotal: number): Promise<Result<AppError, Order[]>> {
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
  async payOrders(@Param('customerId', ParseIntPipe) customerId: number): Promise<Result<AppError, Paid>> {
    return await this.app.payOrders(customerId);
  }

  @Put(':id/tags')
  async tagOrder(@Param('id', ParseIntPipe) id: number, @Body() input: TagList): Promise<Result<AppError, Order>> {
    return await this.app.tagOrder(id, input);
  }
}
