import { Order } from './order.js';
import { AutoIncrement, Column, CreatedAt, DataType, HasMany, PrimaryKey, Table, UpdatedAt } from 'sequelize-typescript';
import { Entity } from 'synapsis-nest';

/** What a customer is: a row of the table customers, with its orders. */
@Table({
  tableName: 'customers',
  underscored: true,
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
})
export class Customer extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(120), allowNull: false, unique: true })
  declare email: string;
  @Column({ type: DataType.STRING(200), allowNull: false })
  declare name: string;
  @Column({ type: DataType.STRING, allowNull: true })
  declare nickname?: string;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare vip: boolean;
  /** what the customer can still spend */
  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0.0 })
  declare credit: number;
  @CreatedAt
  @Column({ type: DataType.DATE(6), allowNull: false })
  declare createdAt?: Date;
  @UpdatedAt
  @Column({ type: DataType.DATE(6), allowNull: false })
  declare updatedAt?: Date;
  @HasMany(() => Order, { foreignKey: 'customerId', constraints: false })
  declare orders?: Order[];
}
