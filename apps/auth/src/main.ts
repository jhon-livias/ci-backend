import { bootstrapRestApplication } from '../../../libs/common/src/index.js';
import { AppModule } from './app.module.js';
import { registerNotificationTransports } from './interfaces/http/notification-stream.js';

void bootstrapRestApplication(AppModule, 'auth', registerNotificationTransports);
