import { Field, ID, Int, ObjectType } from 'type-graphql';
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
export class SymbolMap {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('varchar', { length: 128 })
    globalSymbol!: string;
}

@ObjectType()
@Entity()
@Unique('globalSymbol', ['globalSymbol'])
export class Instrument implements IInstrument {
    @Field(() => ID)
    @PrimaryColumn('bigint')
    id!: number;

    @Field()
    @Column('varchar', { length: 128 })
    globalSymbol!: string;

    @Field()
    @Column('varchar', { length: 32 })
    instrumentToken!: string;

    @Field()
    @Column('varchar', { length: 32 })
    exchangeToken!: string;

    @Column('varchar', { length: 64 })
    @Index()
    tradingSymbol!: string;

    @Field()
    @Column('varchar', { length: 256 })
    @Index()
    name!: string;

    @Field()
    @Column('double')
    lastPrice!: number;

    @Field()
    @Column('int')
    @Index()
    expiry!: number;

    @Field()
    @Column('double')
    @Index()
    strike!: number;

    @Field()
    @Column('double')
    tickSize!: number;

    @Field()
    @Column()
    lotSize!: number;

    @Field()
    @Column('varchar', { length: 16 })
    @Index()
    instrumentType!: string;

    @Field()
    @Column('varchar', { length: 16 })
    @Index()
    segment!: string;

    @Field()
    @Column('varchar', { length: 16 })
    @Index()
    exchange!: string;

    @Field()
    @Column('boolean', { default: false })
    @Index()
    track!: boolean;

    @Field()
    @Column('boolean', { default: true })
    @Index()
    live!: boolean;

    @Field(() => Int)
    @Column('int', { default: 100000 })
    @Index()
    rank!: number;

    @Field()
    @UpdateDateColumn()
    updatedAt!: Date;

    @Field()
    @UpdateDateColumn()
    createdAt!: Date;
}

@Entity()
@Unique('globalSymbol', ['globalSymbol'])
export class InstrumentMeta {
    @Field(() => ID)
    @PrimaryColumn('bigint')
    id!: number;

    @Column('varchar', { length: 128 })
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
