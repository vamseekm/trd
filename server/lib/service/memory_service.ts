/* eslint-disable no-useless-constructor */
import { Service } from 'typedi';
import { Redis } from '../../infra';

@Service()
export class MSService {
    constructor(redis: Redis) {}
}
