/* eslint-disable @typescript-eslint/no-var-requires */
import { Column, DataType, Index, Model, Table } from 'sequelize-typescript';

import { Candle } from '../types/candle';

@Table({ tableName: 'candle', timestamps: false })
export class CandleModel extends Model<CandleModel> implements Candle {
    @Column({ primaryKey: true, type: DataType.STRING(128) })
    key!: string;

    @Index
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
