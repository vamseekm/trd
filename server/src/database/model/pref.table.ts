import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ timestamps: false, tableName: 'pref' })
export class PrefModel extends Model<PrefModel> {
    @Column({ type: DataType.STRING(128), primaryKey: true })
    key!: string;

    @Column({ type: DataType.STRING(128) })
    value!: string;
}
