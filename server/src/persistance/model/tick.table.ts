import { Column, DataType, Index, Model, Table } from 'sequelize-typescript';

/* eslint-disable @typescript-eslint/no-var-requires */
@Table({ timestamps: false, tableName: 'tick' })
export class TickModel extends Model<TickModel> {
    @Column({ type: DataType.BIGINT, primaryKey: true, autoIncrement: true })
    id!: number;

    @Column({ type: DataType.STRING(128) })
    instrumentId!: string;

    @Index
    @Column({ type: DataType.STRING(16) })
    exchange!: string;

    @Index
    @Column({ type: DataType.STRING(64) })
    tradingSymbol!: string;

    @Column({ type: DataType.DOUBLE })
    lastTradedPrice!: number;

    @Column
    totalVolume!: number;

    @Column
    totalBuyQuantity!: number;

    @Column
    totalSellQuantity!: number;

    @Index
    @Column
    timestamp!: Date;

    @Column
    lastTradeTimestamp!: Date;

    @Column({ defaultValue: 0 })
    openInterest!: number;

    @Column({ type: DataType.JSON })
    depth!: any;
}
