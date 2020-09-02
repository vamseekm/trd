import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Candle {
    @PrimaryColumn({ type: 'varchar', length: 128 })
    k!: string;

    @Column()
    t!: Date;

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

    @Column({ type: 'bigint', default: 0 })
    oi!: number;

    @Column({ type: 'bigint', default: 0 })
    tv!: number;

    @Column({ type: 'bigint', default: 0 })
    toi!: number;
}
