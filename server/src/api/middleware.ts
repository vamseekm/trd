import { NextFunction, Request, Response } from 'express';

import { Log } from '../infra';
export class ErrorHandler extends Error {
    constructor(public statusCode: number, public errorMessage: string) {
        super();
    }
}

export function throwNotFound(message?: string): void {
    throw new ErrorHandler(404, message || 'Not found');
}

export function throwServerError(message?: string): void {
    throw new ErrorHandler(404, message || 'Server error');
}

export function handleError(error: ErrorHandler, _request: Request, response: Response, _next: NextFunction): void {
    let { statusCode, errorMessage } = error;
    statusCode = statusCode || 500;
    errorMessage = errorMessage || error.message || 'Unknown error';
    response.status(statusCode).send({
        status: 'error',
        statusCode,
        errorMessage,
    });
}

type handlerType = (request: Request, response: Response, next: NextFunction) => Promise<void>;
export function expressWrap(handler: handlerType): handlerType {
    return async function (request: Request, response: Response, next: NextFunction): Promise<void> {
        try {
            await handler(request, response, next);
        } catch (error) {
            Log.error(error);
            next(error);
        }
    };
}
