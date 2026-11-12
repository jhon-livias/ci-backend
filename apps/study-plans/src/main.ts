import { bootstrapRestApplication } from '../../../libs/common/src/index.js';

import { AppModule } from './app.module.js';

void bootstrapRestApplication(AppModule, 'study-plans', undefined, { bodyLimit: 12 * 1024 * 1024 });
