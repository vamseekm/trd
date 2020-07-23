import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryColumn,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

import { IInstrument } from '../types';

@Entity()
@Unique('globalSymbol', ['globalSymbol'])
export class Instrument implements IInstrument {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('varchar', { length: 128 })
    globalSymbol!: string;

    @Column('varchar', { length: 32 })
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

    @UpdateDateColumn()
    updatedAt!: Date;

    @UpdateDateColumn()
    createdAt!: Date;
}

@Entity()
export class InstrumentMeta {
    @PrimaryColumn('varchar', { length: 128 })
    globalSymbol!: string;

    @Column('varchar', { length: 64 })
    tradingSymbol!: string;

    @Column('varchar', { length: 16 })
    exchange!: string;

    @Column('double', { nullable: true, precision: 16, scale: 2 })
    @Index()
    freeFloatMarketCap!: number;

    @Column('double', { nullable: true, precision: 5, scale: 2 })
    @Index()
    freeFloatPercent!: number;

    @Column('double', { nullable: true, precision: 16, scale: 2 })
    @Index()
    totalMarketCap!: number;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt!: Date;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date;
}
