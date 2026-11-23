import { Customer } from './customer.js';
import { AutoIncrement, BelongsTo, Column, DataType, PrimaryKey, Table } from 'sequelize-typescript';
import { Entity, Related } from 'synapsis-nest';

/**
 * What a coupon is: a row of the table coupons, of one customer. A customer with coupons is not removed: the foreign
 * key has no rule, so the database refuses it.
 */
@Table({
  tableName: 'coupons',
  underscored: true,
  timestamps: false,
})
export class Coupon extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(20), allowNull: false, unique: true })
  declare code: string;
  @BelongsTo(() => Customer, { foreignKey: 'customerId', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  declare customer?: Related<Customer>;
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare customerId: number;
}
