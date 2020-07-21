import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class NSEInstrument {
    @PrimaryColumn('varchar', { length: 64 })
    tradingSymbol!: string;

    @Column('double')
    @Index()
    marketCap!: number;
}
