import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Tick {
    @PrimaryColumn({ type: 'bigint', generated: 'increment' })
    id!: number;

    @Column('bigint')
    @Index()
    timestamp!: number;

    @Column('varchar', { length: 1024 })
    tickString!: string;
}
