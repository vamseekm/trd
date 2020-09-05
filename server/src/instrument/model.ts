/* eslint-disable @typescript-eslint/no-var-requires */
import { getModelForClass, modelOptions, plugin, prop } from '@typegoose/typegoose';
const { logExecutionTime } = require('mongoose-execution-time');
@plugin(logExecutionTime)
@modelOptions({ schemaOptions: { toObject: { virtuals: true }, timestamps: true } })
export class InstrumentClass {
    @prop({ unique: true })
    globalSymbol!: string;

    @prop({ index: true })
    instrumentToken!: string;

    @prop()
    exchangeToken!: string;

    @prop({ index: true })
    tradingSymbol!: string;

    @prop()
    name!: string;

    @prop()
    lastPrice!: number;

    @prop({ index: true })
    expiry!: Date;

    @prop({ index: true })
    lastPriceUpdatedOn!: Date;

    @prop({ index: true })
    strike!: number;

    @prop()
    tickSize!: number;

    @prop()
    lotSize!: number;

    @prop({ index: true })
    rank!: number;

    @prop({ index: true })
    instrumentType!: string;

    @prop({ index: true })
    segment!: string;

    @prop({ index: true })
    exchange!: string;

    @prop({ index: true, default: false })
    track!: boolean;

    @prop({ index: true, default: true })
    live!: boolean;
}

export const InstrumentModel = getModelForClass(InstrumentClass);
