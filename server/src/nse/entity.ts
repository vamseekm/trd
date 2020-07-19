import { Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class NSEInstrument {
    @PrimaryColumn('varchar', { length: 64 })
    tradingSymbol!: string;
}
