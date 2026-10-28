import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AcademicConfigError, ACADEMIC_CATALOG_KINDS, ACADEMIC_CATALOG_TITLES, isAcademicCatalogKind, normalizeAcademicRules, normalizeCatalogName, type AcademicCatalogKind, type AcademicRules } from '../../../../libs/contracts/src/academic-config.js';
import { formatRange } from '../../../../libs/contracts/src/schedule-combo.js';
import { AcademicPrismaService } from '../infrastructure/persistence/academic-prisma.service.js';

const MAX_ITEMS = 40;

@Injectable()
export class AcademicConfigService {
  constructor(private readonly db: AcademicPrismaService) {}

  async read() {
    const [items, rules, combos] = await Promise.all([
      this.db.academicCatalogItem.findMany({
        where: { deletedAt: null },
        select: { id: true, kind: true, name: true, position: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.db.academicRules.findFirst({
        select: {
          minStudents: true,
          maxStudents: true,
          absencePercent: true,
          passingGrade: true,
          evaluationsPerGroup: true,
          maxScorePerEvaluation: true,
        },
      }),
      this.db.scheduleCombo.findMany({
        include: { slots: true },
        orderBy: { number: 'asc' },
      }),
    ]);
    if (!rules) throw new NotFoundException('No se encontraron las reglas académicas.');
    return {
      catalogs: ACADEMIC_CATALOG_KINDS.map((kind) => ({
        kind,
        title: ACADEMIC_CATALOG_TITLES[kind],
        items: items.filter((item) => item.kind === kind).map((item) => ({ id: item.id, name: item.name })),
      })),
      rules,
      schedules: combos.flatMap((combo) => combo.slots.map((slot) => ({
        number: combo.number,
        day: slot.day,
        classType: slot.classKind === 'SYNCHRONOUS' ? 'Síncrona' : 'Asíncrona',
        hours: formatRange(slot.startMinutes, slot.endMinutes),
        owner: 'Director',
      }))),
    };
  }

  async addItem(kind: string, rawName: string) {
    if (!isAcademicCatalogKind(kind)) throw new BadRequestException('Ese catálogo no existe.');
    const name = this.checkedName(rawName);
    const active = await this.db.academicCatalogItem.findMany({ where: { kind, deletedAt: null }, select: { name: true, position: true } });
    if (active.length >= MAX_ITEMS) throw new BadRequestException('Ese catálogo ya tiene el máximo de elementos.');
    if (active.some((item) => item.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) {
      throw new ConflictException('Ese elemento ya está en el catálogo.');
    }
    const position = active.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    try {
      const created = await this.db.academicCatalogItem.create({ data: { kind, name, position }, select: { id: true, kind: true, name: true } });
      return { id: created.id, kind: created.kind, name: created.name, title: ACADEMIC_CATALOG_TITLES[kind] };
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async removeItem(id: string) {
    const current = await this.db.academicCatalogItem.findFirst({ where: { id, deletedAt: null }, select: { kind: true, name: true } });
    if (!current || !isAcademicCatalogKind(current.kind)) throw new NotFoundException();
    const result = await this.db.academicCatalogItem.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!result.count) throw new NotFoundException();
    return { kind: current.kind, name: current.name, title: ACADEMIC_CATALOG_TITLES[current.kind] };
  }

  async saveRules(input: AcademicRules) {
    const rules = this.checkedRules(input);
    const current = await this.db.academicRules.findFirst({ select: { id: true } });
    if (!current) throw new NotFoundException('No se encontraron las reglas académicas.');
    await this.db.academicRules.update({ where: { id: current.id }, data: rules });
    return rules;
  }

  private checkedName(value: string): string {
    try {
      return normalizeCatalogName(value);
    } catch (error) {
      if (error instanceof AcademicConfigError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private checkedRules(input: AcademicRules): AcademicRules {
    try {
      return normalizeAcademicRules(input);
    } catch (error) {
      if (error instanceof AcademicConfigError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private rethrowPersistence(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('Ese elemento ya está en el catálogo.');
    }
    throw error;
  }
}
