import { Tag } from '../data/entities/tag.js';
import { NewTag } from '../domain/models/new_tag.js';
import { StoreAppComponent } from '../store_appcomponent.js';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AppError, IntPipe, Result } from 'synapsis-nest';

/** The routes of tags. */
@Controller('tags')
export class TagsController {
  constructor(private readonly app: StoreAppComponent) {}

  @Get()
  async list(@Query('page', IntPipe) page: number = 1): Promise<Result<AppError, Tag[]>> {
    return await this.app.listTags(page);
  }

  @Post()
  async create(@Body() input: NewTag): Promise<Result<AppError, Tag>> {
    return await this.app.createTag(input);
  }
}
