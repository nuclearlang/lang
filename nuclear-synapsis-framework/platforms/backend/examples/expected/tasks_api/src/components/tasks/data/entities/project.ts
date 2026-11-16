import { Task } from './task.js';
import { AutoIncrement, Column, DataType, HasMany, PrimaryKey, Table } from 'sequelize-typescript';
import { Entity } from 'synapsis-nest';

/** A project groups tasks (table projects); removing it removes its tasks. */
@Table({
  tableName: 'projects',
  underscored: true,
  timestamps: false,
})
export class Project extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;
  @HasMany(() => Task, { foreignKey: 'projectId', constraints: false })
  declare tasks?: Task[];
}
