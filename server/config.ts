import { Service } from 'typedi';

@Service()
export class Config {
    get(key: string): string {
        if (!process.env[key]) {
            throw new Error(`${key} not found in env`);
        }
        return process.env[key] || '';
    }
}
