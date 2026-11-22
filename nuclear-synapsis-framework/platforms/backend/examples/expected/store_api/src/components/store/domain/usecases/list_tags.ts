import { Tag } from '../../data/entities/tag.js';
import { TagRepository } from '../../data/repositories/tag_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** One page of tags. */
@Injectable()
export class ListTags {
  constructor(private readonly repository: TagRepository) {}

  async exec(page: number): Promise<Result<AppError, Tag[]>> {
    const found = await this.repository.page(page, 20);
    return Ok(found.items);
  }
}
