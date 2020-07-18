import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class Pref {
    @PrimaryColumn()
    key!: string;

    @Column({ nullable: false })
    value!: string;
}
