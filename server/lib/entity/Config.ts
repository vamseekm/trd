import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class Config {
    @PrimaryColumn()
    key!: string;

    @Column({ nullable: false })
    value!: string;
}
