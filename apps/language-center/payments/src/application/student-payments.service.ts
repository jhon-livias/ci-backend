import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { formatSoles } from '../../../../../libs/contracts/src/payment-catalog.js';
import { limaCalendar } from '../../../../../libs/contracts/src/lima-calendar.js';
import { PaymentsPrismaService } from '../infrastructure/persistence/payments-prisma.service.js';
import { StudentPaymentConcept, StudentPaymentStatus } from '../infrastructure/persistence/generated/client.js';

const present = (row: {
  id: string;
  correlative: string;
  createdAt: Date;
  amountCents: number;
  detail: string;
  concept: StudentPaymentConcept;
  status: StudentPaymentStatus;
}) => ({
  id: row.id,
  correlative: row.correlative,
  createdAt: row.createdAt.toISOString(),
  amountCents: row.amountCents,
  amount: formatSoles(row.amountCents),
  detail: row.detail,
  concept: row.concept,
  status: row.status,
  statusLabel: row.status === StudentPaymentStatus.CONFIRMED ? 'Pagado' : row.status === StudentPaymentStatus.FAILED ? 'Fallido' : 'Pendiente de pasarela',
});

@Injectable()
export class StudentPaymentsService {
  constructor(private readonly db: PaymentsPrismaService) {}

  async list(studentUserId: string) {
    const rows = await this.db.studentPayment.findMany({
      where: { studentUserId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return { payments: rows.map(present) };
  }

  async create(input: {
    readonly studentUserId: string;
    readonly studentName: string;
    readonly concept: 'ENROLLMENT' | 'PROFICIENCY';
    readonly detail: string;
    readonly tariffCode: string;
  }) {
    if (!/^[^<>]{1,200}$/u.test(input.studentName) || !/^[^<>]{1,240}$/u.test(input.detail) || !/^[A-Z][A-Z0-9_]{1,30}$/u.test(input.tariffCode)) {
      throw new BadRequestException('Revisa los datos del pago.');
    }
    const tariff = await this.db.enrollmentTariff.findUnique({ where: { code: input.tariffCode }, select: { code: true, amountCents: true } });
    if (!tariff) throw new NotFoundException('No hay una tarifa configurada para ese concepto.');
    const correlative = await this.nextCorrelative();
    const created = await this.db.studentPayment.create({
      data: {
        studentUserId: input.studentUserId,
        studentName: input.studentName.trim(),
        concept: input.concept === 'PROFICIENCY' ? StudentPaymentConcept.PROFICIENCY : StudentPaymentConcept.ENROLLMENT,
        detail: input.detail.trim(),
        amountCents: tariff.amountCents,
        tariffCode: tariff.code,
        correlative,
        status: StudentPaymentStatus.PENDING,
      },
    });
    return present(created);
  }

  private async nextCorrelative(): Promise<string> {
    const date = limaCalendar().date.replaceAll('-', '');
    const prefix = `CI-${date}-`;
    const last = await this.db.studentPayment.findFirst({
      where: { correlative: { startsWith: prefix } },
      orderBy: { correlative: 'desc' },
      select: { correlative: true },
    });
    const sequence = last ? Number(last.correlative.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(sequence) ? sequence : 1).padStart(4, '0')}`;
  }
}
