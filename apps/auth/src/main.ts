import { bootstrapRestApplication } from '../../../libs/common/src/index.js';

import { AppModule } from './app.module.js';

void bootstrapRestApplication(AppModule, 'auth');
