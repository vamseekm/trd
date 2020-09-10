/* eslint-disable @typescript-eslint/no-var-requires */
import { getModelForClass, modelOptions, plugin, prop, Severity } from '@typegoose/typegoose';
import { Schema } from 'mongoose';
const { logExecutionTime } = require('mongoose-execution-time');

@plugin(logExecutionTime)
@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class Tick {
    @prop({ index: true })
    globalSymbol!: string;

    @prop({ index: true })
    exchange!: string;

    @prop({ index: true })
    tradingSymbol!: string;

    @prop()
    lastTradedPrice!: number;

    @prop()
    totalVolume!: number;

    @prop()
    totalBuyQuantity!: number;

    @prop()
    totalSellQuantity!: number;

    @prop({ index: true })
    timestamp!: Date;

    @prop()
    lastTradeTimestamp!: Date;

    @prop()
    openInterest!: number;

    @prop({ type: Schema.Types.Mixed })
    depth!: any;
}
export const TickModel = getModelForClass(Tick, { schemaOptions: { shardKey: { globalSymbol: 1 } } });
