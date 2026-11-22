import { Tag } from '../../data/entities/tag.js';
import { TagRepository } from '../../data/repositories/tag_repository.js';
import { NewTag } from '../models/new_tag.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** Adds a tag. */
@Injectable()
export class CreateTag {
  constructor(private readonly repository: TagRepository) {}

  async exec(input: NewTag): Promise<Result<AppError, Tag>> {
    return Ok(await this.repository.save(new Tag({ label: input.label })));
  }
}
