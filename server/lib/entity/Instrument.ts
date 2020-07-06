import { PrimaryColumn, Column, Entity } from 'typeorm';
import { IInstrument } from '../types/instrument';

@Entity()
export class Instrument implements IInstrument {
    @PrimaryColumn('varchar', { length: 32 })
    instrumentToken!: string;

    @Column('varchar', { length: 32 })
    exchangeToken!: string;

    @Column('varchar', { length: 64 })
    tradingSymbol!: string;

    @Column('varchar', { length: 256 })
    name!: string;

    @Column('decimal', { precision: 10, scale: 2 })
    lastPrice!: number;

    @Column('bigint')
    expiry!: number;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    strike!: number;

    @Column()
    tickSize!: number;

    @Column()
    lotSize!: number;

    @Column('varchar', { length: 16 })
    instrumentType!: string;

    @Column('varchar', { length: 16 })
    segment!: string;

    @Column('varchar', { length: 16 })
    exchange!: string;
}
