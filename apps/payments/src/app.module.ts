import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';
import { PaymentCatalogService } from './application/payment-catalog.service.js';
import { StudentPaymentsService } from './application/student-payments.service.js';
import { PaymentsPrismaService } from './infrastructure/persistence/payments-prisma.service.js';
import { InternalPaymentsGuard, PaymentCatalogController } from './interfaces/http/payment-catalog.controller.js';
import { StudentPaymentsController } from './interfaces/http/student-payments.controller.js';

const HealthController = createHealthController('payments');

@Module({
  controllers: [HealthController, PaymentCatalogController, StudentPaymentsController],
  providers: [PaymentsPrismaService, InternalPaymentsGuard, PaymentCatalogService, StudentPaymentsService],
})
export class AppModule {}
