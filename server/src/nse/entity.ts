import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class NSEInstrument {
    @PrimaryColumn('varchar', { length: 128 })
    globalSymbol!: string;

    @Column('varchar', { length: 64 })
    tradingSymbol!: string;

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
