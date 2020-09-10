import { Column, DataType, Index, Model, Table } from 'sequelize-typescript';

@Table({ timestamps: false, tableName: 'instrument' })
export class InstrumentModel extends Model<InstrumentModel> {
    @Column({ type: DataType.STRING(128), primaryKey: true })
    id!: string;

    @Index
    @Column({ allowNull: false })
    instrumentToken!: string;

    @Column({ allowNull: false })
    exchangeToken!: string;

    @Index
    @Column({ allowNull: false })
    tradingSymbol!: string;

    @Column
    name!: string;

    @Column({ type: DataType.DOUBLE })
    lastPrice!: number;

    @Index
    @Column
    expiry!: Date;

    @Index
    @Column
    lastPriceUpdatedOn!: Date;

    @Index
    @Column({ type: DataType.DOUBLE })
    strike!: number;

    @Column({ type: DataType.FLOAT })
    tickSize!: number;

    @Column
    lotSize!: number;

    @Index
    @Column({ defaultValue: 100000 })
    rank!: number;

    @Index
    @Column
    instrumentType!: string;

    @Index
    @Column
    segment!: string;

    @Index
    @Column
    exchange!: string;

    @Index
    @Column({ defaultValue: false, allowNull: false })
    track!: boolean;

    @Index
    @Column({ defaultValue: false, allowNull: false })
    live!: boolean;
}
