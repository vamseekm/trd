import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class Tick {
    @PrimaryColumn({ type: 'bigint', generated: 'increment' })
    id!: number;

    @Column('bigint')
    @Index()
    timestamp!: number;

    @Column()
    @Index()
    time!: Date;

    @Column('varchar', { length: 128 })
    @Index()
    globalSymbol!: string;

    @Column('varchar', { length: 1024 })
    tickString!: string;
}
