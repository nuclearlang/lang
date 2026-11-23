import { Project } from '../data/entities/project.js';
import { Moved, NewProject } from '../domain/models/task_models.js';
import { TasksAppComponent } from '../tasks_appcomponent.js';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { AppError, IntPipe, RequiredPipe, Result, Token, env, guardedBy } from 'synapsis-nest';

/**
 * Projects: POST /projects, GET /projects/:id (with its tasks and their tags), POST /projects/:id/close/:into.
 * Besides the app's guards, the owner's token (OWNER_TOKEN, as `Authorization: Bearer <token>`).
 */
@Controller('projects')
@guardedBy([new Token({ value: env('OWNER_TOKEN') })])
export class ProjectsController {
  constructor(private readonly tasks: TasksAppComponent) {}

  @Post()
  async create(@Body() input: NewProject): Promise<Result<AppError, Project>> {
    return await this.tasks.addProject(input);
  }

  @Get(':id')
  async one(@Param('id', RequiredPipe, IntPipe) id: number): Promise<Result<AppError, Project>> {
    return await this.tasks.project(id);
  }

  @Post(':id/close/:into')
  @HttpCode(200)
  async close(@Param('id', RequiredPipe, IntPipe) id: number, @Param('into', RequiredPipe, IntPipe) into: number): Promise<Result<AppError, Moved>> {
    return await this.tasks.close(id, into);
  }
}
