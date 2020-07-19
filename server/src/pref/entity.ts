import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Pref {
    @PrimaryColumn()
    key!: string;

    @Column({ nullable: false })
    value!: string;
}
