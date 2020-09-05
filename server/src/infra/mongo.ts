import { mongoose } from '@typegoose/typegoose';

import { Config } from './config';

export async function mongoConnect(): Promise<void> {
    await mongoose.connect(Config.get('MONGODB_URL'), {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        useFindAndModify: true,
    });
}
