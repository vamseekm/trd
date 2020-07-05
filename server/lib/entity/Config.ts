import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class ConfigModel {
    @PrimaryColumn()
    key!: string;

    @Column({ nullable: false })
    value!: string;
}
