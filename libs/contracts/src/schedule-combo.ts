export class ScheduleComboError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleComboError';
  }
}

export const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export const CLASS_KINDS = ['SYNCHRONOUS', 'ASYNCHRONOUS'] as const;
export type ClassKindCode = (typeof CLASS_KINDS)[number];

export const CLASS_KIND_LABEL: Record<ClassKindCode, string> = {
  SYNCHRONOUS: 'Síncrona',
  ASYNCHRONOUS: 'Asíncrona',
};

const HOUR = /^(0[1-9]|1[0-2]):00$/u;
const PERIOD = /^(AM|PM)$/u;

export const clockToMinutes = (hour: string, period: string): number => {
  if (!HOUR.test(hour) || !PERIOD.test(period)) throw new ScheduleComboError('La hora no es válida.');
  const twelve = Number(hour.slice(0, 2));
  const base = twelve === 12 ? 0 : twelve;
  const minutes = (period === 'PM' ? 12 * 60 : 0) + base * 60;
  if (minutes < 0 || minutes > 23 * 60) throw new ScheduleComboError('La hora no es válida.');
  return minutes;
};

export const minutesToClock = (minutes: number): { hour: string; period: 'AM' | 'PM' } => {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 23 * 60 || minutes % 60 !== 0) {
    throw new ScheduleComboError('La hora no es válida.');
  }
  const period = minutes >= 12 * 60 ? 'PM' : 'AM';
  const hour24 = Math.floor(minutes / 60);
  const twelve = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour: `${String(twelve).padStart(2, '0')}:00`, period };
};

export const formatRange = (startMinutes: number, endMinutes: number): string => {
  const start = minutesToClock(startMinutes);
  const end = minutesToClock(endMinutes);
  return `${start.hour} ${start.period} - ${end.hour} ${end.period}`;
};

export type ScheduleSlotDraft = {
  readonly day: string;
  readonly classKind: ClassKindCode;
  readonly startMinutes: number;
  readonly endMinutes: number;
};

export const normalizeSlots = (slots: readonly ScheduleSlotDraft[]): readonly ScheduleSlotDraft[] => {
  if (slots.length === 0) throw new ScheduleComboError('Selecciona al menos un día.');
  const seen = new Set<string>();
  const ordered = WEEK_DAYS.flatMap((day) => slots.filter((slot) => slot.day === day));
  if (ordered.length !== slots.length) throw new ScheduleComboError('El día no es válido.');
  for (const slot of ordered) {
    if (seen.has(slot.day)) throw new ScheduleComboError(`El día ${slot.day} está repetido.`);
    seen.add(slot.day);
    if (!CLASS_KINDS.includes(slot.classKind)) throw new ScheduleComboError('El tipo de clase no es válido.');
    if (slot.endMinutes <= slot.startMinutes) throw new ScheduleComboError(`La hora de salida del ${slot.day} debe ser posterior a la de inicio.`);
  }
  return ordered;
};
