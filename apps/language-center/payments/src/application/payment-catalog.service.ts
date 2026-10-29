import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { formatSoles, normalizeAmountCents, PaymentCatalogError } from '../../../../../libs/contracts/src/payment-catalog.js';
import { PaymentsPrismaService } from '../infrastructure/persistence/payments-prisma.service.js';
import { PaymentIncidentStatus } from '../infrastructure/persistence/generated/client.js';

const presentTariff = (row: { id: string; code: string; name: string; amountCents: number }) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  amountCents: row.amountCents,
  amount: formatSoles(row.amountCents),
});

const presentIncident = (row: {
  id: string;
  occurredAt: Date;
  studentName: string;
  concept: string;
  error: string;
  status: PaymentIncidentStatus;
}) => ({
  id: row.id,
  occurredAt: row.occurredAt.toISOString(),
  studentName: row.studentName,
  concept: row.concept,
  error: row.error,
  status: row.status === PaymentIncidentStatus.RESOLVED ? 'Resuelta' : 'Pendiente',
});

@Injectable()
export class PaymentCatalogService {
  constructor(private readonly db: PaymentsPrismaService) {}

  async read() {
    const [tariffs, incidents, pendingIncidents] = await Promise.all([
      this.db.enrollmentTariff.findMany({
        select: { id: true, code: true, name: true, amountCents: true },
        orderBy: { code: 'asc' },
      }),
      this.db.paymentIncident.findMany({
        select: { id: true, occurredAt: true, studentName: true, concept: true, error: true, status: true },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
      this.db.paymentIncident.count({ where: { status: PaymentIncidentStatus.PENDING } }),
    ]);
    return {
      tariffs: tariffs.map(presentTariff),
      incidents: incidents.map(presentIncident),
      pendingIncidents,
    };
  }

  async updateTariff(id: string, amountCents: number) {
    let cents: number;
    try {
      cents = normalizeAmountCents(amountCents);
    } catch (error) {
      if (error instanceof PaymentCatalogError) throw new BadRequestException(error.message);
      throw error;
    }
    const current = await this.db.enrollmentTariff.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!current) throw new NotFoundException();
    const updated = await this.db.enrollmentTariff.update({
      where: { id },
      data: { amountCents: cents },
      select: { id: true, code: true, name: true, amountCents: true },
    });
    return presentTariff(updated);
  }

  async resolveIncident(id: string) {
    const current = await this.db.paymentIncident.findUnique({
      where: { id },
      select: { id: true, studentName: true, status: true },
    });
    if (!current) throw new NotFoundException();
    if (current.status === PaymentIncidentStatus.RESOLVED) return { id: current.id, studentName: current.studentName, status: 'Resuelta' as const };
    await this.db.paymentIncident.update({
      where: { id },
      data: { status: PaymentIncidentStatus.RESOLVED, resolvedAt: new Date() },
    });
    return { id: current.id, studentName: current.studentName, status: 'Resuelta' as const };
  }
}
