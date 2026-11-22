import { Order } from './order.js';
import { AutoIncrement, BelongsToMany, Column, DataType, PrimaryKey, Table } from 'sequelize-typescript';
import { Entity, joinTable } from 'synapsis-nest';

/** What a tag is: a row of the table tags; an order has many tags and a tag many orders (table orders_tags). */
@Table({
  tableName: 'tags',
  underscored: true,
  timestamps: false,
})
export class Tag extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  declare label: string;
  @BelongsToMany(() => Order, joinTable('orders_tags', 'tag_id', 'order_id'))
  declare orders?: Order[];
}
