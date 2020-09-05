/* eslint-disable @typescript-eslint/no-var-requires */
import { getModelForClass, modelOptions, plugin, post, pre, prop } from '@typegoose/typegoose';
const { logExecutionTime } = require('mongoose-execution-time');
@plugin(logExecutionTime)
@modelOptions({ schemaOptions: { timestamps: true } })
export class CandleClass {
    @prop({ unique: true })
    k!: string;

    @prop()
    t!: Date;

    @prop()
    o!: number;

    @prop()
    h!: number;

    @prop()
    l!: number;

    @prop()
    c!: number;

    @prop()
    v!: number;

    @prop({ default: 0 })
    oi!: number;

    @prop({ default: 0 })
    tv!: number;

    @prop({ default: 0 })
    toi!: number;
}
export const CandleModel = getModelForClass(CandleClass);
