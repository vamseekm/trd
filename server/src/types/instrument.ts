import { IsBoolean, IsDate, IsNumber, IsOptional, IsString } from 'class-validator';

export interface IMetaInfo {
    id: string;
    freeFloatMarketCap: number;
    totalMarketCap: number;
    freeFloatPercent: number;
    metaLastUpdated: Date;
    rank?: number;
}

export class Instrument implements Partial<IMetaInfo> {
    @IsString()
    id!: string;
    @IsString()
    instrumentToken!: string;
    @IsString()
    exchangeToken!: string;
    @IsString()
    tradingSymbol!: string;
    @IsString()
    name!: string;
    @IsNumber()
    lastPrice!: number;
    @IsDate()
    expiry!: Date;
    @IsNumber()
    strike!: number;
    @IsNumber()
    tickSize!: number;
    @IsNumber()
    lotSize!: number;
    @IsString()
    instrumentType!: string;
    @IsString()
    segment!: string;
    @IsString()
    exchange!: string;
    @IsBoolean()
    @IsOptional()
    live?: boolean;
    @IsBoolean()
    @IsOptional()
    track?: boolean;

    @IsNumber()
    @IsOptional()
    freeFloatMarketCap?: number;
    @IsNumber()
    @IsOptional()
    totalMarketCap?: number;
    @IsNumber()
    @IsOptional()
    freeFloatPercent?: number;
    @IsDate()
    @IsOptional()
    metaLastUpdated?: Date;
    @IsNumber()
    @IsOptional()
    rank?: number;
}

export const INSTRUMENT_ID_SEPERATOR = ':';
