import { Customer } from '../data/entities/customer.js';
import { NewCustomer } from '../domain/models/new_customer.js';
import { StoreAppComponent } from '../store_appcomponent.js';
import { Body, Controller, Delete, Get, Param, ParseFloatPipe, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { AppError, Page, Result } from 'synapsis-nest';

/** The routes of customers. */
@Controller('customers')
export class CustomersController {
  constructor(private readonly app: StoreAppComponent) {}

  @Get()
  async list(@Query('page', new ParseIntPipe({ optional: true })) page: number): Promise<Result<AppError, Customer[]>> {
    return await this.app.listCustomers(page);
  }

  @Get(':id')
  async one(@Param('id', ParseIntPipe) id: number): Promise<Result<AppError, Customer>> {
    return await this.app.getCustomer(id);
  }

  @Post()
  async create(@Body() input: NewCustomer): Promise<Result<AppError, Customer>> {
    return await this.app.createCustomer(input);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: NewCustomer): Promise<Result<AppError, Customer>> {
    return await this.app.updateCustomer(id, input);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<Result<AppError, boolean>> {
    return await this.app.deleteCustomer(id);
  }

  @Get('page')
  async pageCustomers(@Query('page', new ParseIntPipe({ optional: true })) page: number, @Query('size', new ParseIntPipe({ optional: true })) size: number): Promise<Result<AppError, Page<Customer>>> {
    return await this.app.pageCustomers(page, size);
  }

  @Get('search')
  async searchCustomers(@Query('text') text: string, @Query('page', new ParseIntPipe({ optional: true })) page: number, @Query('size', new ParseIntPipe({ optional: true })) size: number): Promise<Result<AppError, Page<Customer>>> {
    return await this.app.searchCustomers(text, page, size);
  }

  @Get('vips')
  async vipCustomers(@Query('credit', new ParseFloatPipe({ optional: true })) credit: number): Promise<Result<AppError, Customer[]>> {
    return await this.app.vipCustomers(credit);
  }

  @Get(':id/orders')
  async customerOrders(@Param('id', ParseIntPipe) id: number): Promise<Result<AppError, Customer>> {
    return await this.app.customerOrders(id);
  }
}
