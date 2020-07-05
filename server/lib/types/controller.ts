import express from 'express';

export interface IController {
    publicRoutes(): Promise<express.Router>;
}
