import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Pref {
    @PrimaryColumn()
    key!: string;

    @Column({ nullable: false, type: 'text' })
    value!: string;
}
