import { Module } from '@nestjs/common';

import { createHealthController } from '../../../libs/common/src/index.js';
import { PaymentCatalogService } from './application/payment-catalog.service.js';
import { PaymentsPrismaService } from './infrastructure/persistence/payments-prisma.service.js';
import { InternalPaymentsGuard, PaymentCatalogController } from './interfaces/http/payment-catalog.controller.js';

const HealthController = createHealthController('payments');

@Module({
  controllers: [HealthController, PaymentCatalogController],
  providers: [PaymentsPrismaService, InternalPaymentsGuard, PaymentCatalogService],
})
export class AppModule {}
