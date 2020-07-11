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

    @Column('double')
    lastPrice!: number;

    @Column('int')
    expiry!: number;

    @Column('double')
    strike!: number;

    @Column('double')
    tickSize!: number;

    @Column()
    lotSize!: number;

    @Column('varchar', { length: 16 })
    instrumentType!: string;

    @Column('varchar', { length: 16 })
    segment!: string;

    @Column('varchar', { length: 16 })
    exchange!: string;

    @Column('boolean', { default: false })
    track!: boolean;

    @Column('boolean', { default: true })
    live!: boolean;
}
