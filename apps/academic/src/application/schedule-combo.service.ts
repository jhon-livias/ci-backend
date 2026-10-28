import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { CLASS_KIND_LABEL, formatRange, normalizeSlots, ScheduleComboError, type ScheduleSlotDraft } from '../../../../libs/contracts/src/schedule-combo.js';
import { AcademicPrismaService } from '../infrastructure/persistence/academic-prisma.service.js';
import { ClassKind } from '../infrastructure/persistence/generated/client.js';

const present = (combo: {
  id: string;
  number: number;
  slots: readonly { day: string; classKind: ClassKind; startMinutes: number; endMinutes: number }[];
}) => ({
  id: combo.id,
  number: combo.number,
  days: combo.slots.map((slot) => slot.day).join(' - '),
  classTypes: combo.slots.map((slot) => `${slot.day}: ${CLASS_KIND_LABEL[slot.classKind]}`).join(', '),
  hours: combo.slots.map((slot) => `${slot.day}: ${formatRange(slot.startMinutes, slot.endMinutes)}`).join(', '),
  dayLabel: combo.slots.map((slot) => slot.day).join(' - '),
  hourLabel: combo.slots[0] ? formatRange(combo.slots[0].startMinutes, combo.slots[0].endMinutes) : '',
  slots: combo.slots.map((slot) => ({
    day: slot.day,
    classKind: slot.classKind,
    classType: CLASS_KIND_LABEL[slot.classKind],
    startMinutes: slot.startMinutes,
    endMinutes: slot.endMinutes,
    hours: formatRange(slot.startMinutes, slot.endMinutes),
  })),
});

@Injectable()
export class ScheduleComboService {
  constructor(private readonly db: AcademicPrismaService) {}

  async list() {
    const combos = await this.db.scheduleCombo.findMany({
      include: { slots: { orderBy: { day: 'asc' } } },
      orderBy: { number: 'asc' },
    });
    return { combos: combos.map(present) };
  }

  async create(slots: readonly ScheduleSlotDraft[]) {
    let normalized: readonly ScheduleSlotDraft[];
    try {
      normalized = normalizeSlots(slots);
    } catch (error) {
      if (error instanceof ScheduleComboError) throw new BadRequestException(error.message);
      throw error;
    }
    const last = await this.db.scheduleCombo.findFirst({ select: { number: true }, orderBy: { number: 'desc' } });
    const created = await this.db.scheduleCombo.create({
      data: {
        number: (last?.number ?? 0) + 1,
        slots: {
          create: normalized.map((slot) => ({
            day: slot.day,
            classKind: slot.classKind,
            startMinutes: slot.startMinutes,
            endMinutes: slot.endMinutes,
          })),
        },
      },
      include: { slots: true },
    });
    return present(created);
  }

  async remove(id: string) {
    const used = await this.db.academicGroup.count({ where: { OR: [{ dayComboId: id }, { hourComboId: id }] } });
    if (used > 0) throw new ConflictException('No puedes eliminar este combo porque está asignado a un grupo.');
    const current = await this.db.scheduleCombo.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new NotFoundException();
    await this.db.scheduleCombo.delete({ where: { id } });
  }
}
