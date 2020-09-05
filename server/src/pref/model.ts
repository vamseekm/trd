import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { timestamps: true } })
class PrefClass {
    @prop({ unique: true })
    public key!: string;

    @prop()
    public value!: string;
}

export const PrefModel = getModelForClass(PrefClass);
