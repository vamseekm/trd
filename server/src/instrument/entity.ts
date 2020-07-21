import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

import { IInstrument } from '../types';

@Entity()
@Unique('exchange_tradingSymbol2', ['exchange', 'tradingSymbol'])
export class Instrument implements IInstrument {
    @PrimaryColumn('varchar', { length: 32 })
    instrumentToken!: string;

    @Column('varchar', { length: 32 })
    exchangeToken!: string;

    @Column('varchar', { length: 64 })
    @Index()
    tradingSymbol!: string;

    @Column('varchar', { length: 256 })
    @Index()
    name!: string;

    @Column('double')
    lastPrice!: number;

    @Column('int')
    @Index()
    expiry!: number;

    @Column('double')
    @Index()
    strike!: number;

    @Column('double')
    tickSize!: number;

    @Column()
    lotSize!: number;

    @Column('varchar', { length: 16 })
    @Index()
    instrumentType!: string;

    @Column('varchar', { length: 16 })
    @Index()
    segment!: string;

    @Column('varchar', { length: 16 })
    @Index()
    exchange!: string;

    @Column('boolean', { default: false })
    @Index()
    track!: boolean;

    @Column('boolean', { default: true })
    @Index()
    live!: boolean;

    @Column('int', { default: 100000 })
    @Index()
    rank!: number;
}
