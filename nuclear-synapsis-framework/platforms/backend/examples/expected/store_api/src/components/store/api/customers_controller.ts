import { Customer } from '../data/entities/customer.js';
import { NewCustomer } from '../domain/models/new_customer.js';
import { StoreAppComponent } from '../store_appcomponent.js';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AppError, DoublePipe, IntPipe, Page, RequiredPipe, Result, TextPipe } from 'synapsis-nest';

/** The routes of customers. */
@Controller('customers')
export class CustomersController {
  constructor(private readonly app: StoreAppComponent) {}

  @Get()
  async list(@Query('page', IntPipe) page: number = 1): Promise<Result<AppError, Customer[]>> {
    return await this.app.listCustomers(page);
  }

  @Get(':id')
  async one(@Param('id', RequiredPipe, IntPipe) id: number): Promise<Result<AppError, Customer>> {
    return await this.app.getCustomer(id);
  }

  @Post()
  async create(@Body() input: NewCustomer): Promise<Result<AppError, Customer>> {
    return await this.app.createCustomer(input);
  }

  @Put(':id')
  async update(@Param('id', RequiredPipe, IntPipe) id: number, @Body() input: NewCustomer): Promise<Result<AppError, Customer>> {
    return await this.app.updateCustomer(id, input);
  }

  @Delete(':id')
  async remove(@Param('id', RequiredPipe, IntPipe) id: number): Promise<Result<AppError, boolean>> {
    return await this.app.deleteCustomer(id);
  }

  @Get('page')
  async pageCustomers(@Query('page', RequiredPipe, IntPipe) page: number, @Query('size', RequiredPipe, IntPipe) size: number): Promise<Result<AppError, Page<Customer>>> {
    return await this.app.pageCustomers(page, size);
  }

  @Get('search')
  async searchCustomers(@Query('text', RequiredPipe, TextPipe) text: string, @Query('page', RequiredPipe, IntPipe) page: number, @Query('size', RequiredPipe, IntPipe) size: number): Promise<Result<AppError, Page<Customer>>> {
    return await this.app.searchCustomers(text, page, size);
  }

  @Get('vips')
  async vipCustomers(@Query('credit', RequiredPipe, DoublePipe) credit: number): Promise<Result<AppError, Customer[]>> {
    return await this.app.vipCustomers(credit);
  }

  @Get(':id/orders')
  async customerOrders(@Param('id', RequiredPipe, IntPipe) id: number): Promise<Result<AppError, Customer>> {
    return await this.app.customerOrders(id);
  }

  @Get('draft')
  draftCustomer(@Query('email', RequiredPipe, TextPipe) email: string): Result<AppError, NewCustomer> {
    return this.app.draftCustomer(email);
  }
}
