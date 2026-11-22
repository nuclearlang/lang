import { Customer } from './customer.js';
import { Tag } from './tag.js';
import { AutoIncrement, BelongsTo, BelongsToMany, Column, CreatedAt, DataType, PrimaryKey, Table } from 'sequelize-typescript';
import { Entity, Related, joinTable } from 'synapsis-nest';

/** What an order is: a row of the table orders, of one customer and with tags; removing the customer removes it. */
@Table({
  tableName: 'orders',
  underscored: true,
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
})
export class Order extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @BelongsTo(() => Customer, { foreignKey: 'customerId', onDelete: 'cascade' })
  declare customer?: Related<Customer>;
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare customerId: number;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  declare quantity: number;
  @Column({ type: DataType.DOUBLE, allowNull: false })
  declare total: number;
  @Column({ type: DataType.STRING(2000), allowNull: true })
  declare note?: string;
  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: 'pending' })
  declare status: string;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare paid: boolean;
  /** when the customer asked for it, as the client said */
  @Column({ type: DataType.DATE, allowNull: true })
  declare placedAt?: Date;
  @CreatedAt
  declare createdAt?: Date;
  @BelongsToMany(() => Tag, joinTable('orders_tags', 'order_id', 'tag_id'))
  declare tags?: Tag[];
}
