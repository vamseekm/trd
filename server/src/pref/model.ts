import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { timestamps: true } })
class Pref {
    @prop({ unique: true })
    public key!: string;

    @prop()
    public value!: string;
}

export const PrefModel = getModelForClass(Pref);
