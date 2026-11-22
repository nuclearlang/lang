import { Tag } from '../entities/tag.js';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppError, Page, Repository, Result } from 'synapsis-nest';

/** The tags of the database: find, findAll, save and remove come with it. */
@Injectable()
export class TagRepository extends Repository<Tag> {
  constructor(@InjectModel(Tag) model: typeof Tag) {
    super(model);
  }

  page(page: number, size: number = 20): Promise<Page<Tag>> {
    const q = this.query();
    q.orderBy('id');
    return q.paginate(page, size);
  }

  byLabel(label: string): Promise<Result<AppError, Tag>> {
    const q = this.query();
    q.where({ 'label': label });
    return q.getOne();
  }
}
