import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Candle {
    @PrimaryColumn('bigint')
    iid!: number;

    @PrimaryColumn('int')
    t!: number;

    @Column('double')
    o!: number;

    @Column('double')
    h!: number;

    @Column('double')
    l!: number;

    @Column('double')
    c!: number;

    @Column('bigint')
    v!: number;

    @Column('bigint')
    tv!: number;

    @Column('bigint')
    oi!: number;

    @Column('varchar', { length: 4 })
    p!: string;
}
