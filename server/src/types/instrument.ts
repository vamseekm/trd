import { IsBoolean, IsDate, IsNumber, IsOptional, IsString } from 'class-validator';
export class Instrument {
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
}

export const INSTRUMENT_ID_SEPERATOR = '_';
