/* eslint-disable @typescript-eslint/no-var-requires */
import { Column, DataType, Model, Table } from 'sequelize-typescript';

import { Indicator } from '../../types';

@Table({ tableName: 'indicator', timestamps: false })
export class IndicatorModel extends Model<IndicatorModel> implements Indicator {
    @Column({ primaryKey: true, type: DataType.STRING(128) })
    key!: string;

    @Column({ type: DataType.STRING(64) })
    instrumentId!: string;

    @Column({ type: DataType.STRING(8) })
    exchange!: string;

    @Column({ type: DataType.STRING(8) })
    interval!: string;

    @Column
    timeCode!: number;

    @Column({ allowNull: false })
    timestamp!: Date;

    @Column({ type: DataType.DOUBLE, allowNull: false })
    open!: number;

    @Column({ type: DataType.DOUBLE, allowNull: false })
    high!: number;

    @Column({ type: DataType.DOUBLE, allowNull: false })
    low!: number;

    @Column({ type: DataType.DOUBLE, allowNull: false })
    close!: number;

    @Column({ type: DataType.BIGINT, allowNull: false })
    volume!: number;

    @Column({ defaultValue: 0, allowNull: false })
    openInterest!: number;

    @Column({ defaultValue: 0, allowNull: false })
    totalVolume!: number;

    @Column({ defaultValue: 0, allowNull: false })
    totalOpenInterest!: number;
}
