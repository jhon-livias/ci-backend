import { type WeekDay } from './schedule-combo.js';

const WEEKDAY: Record<string, WeekDay> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export type LimaCalendar = {
  readonly day: WeekDay;
  readonly date: string;
  readonly clock: string;
};

export const limaCalendar = (at = new Date()): LimaCalendar => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(at).map((part) => [part.type, part.value]),
  );
  const key = (parts['weekday'] ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const day = WEEKDAY[key] ?? 'Lunes';
  return {
    day,
    date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    clock: `${parts['hour']}:${parts['minute']}:${parts['second']}`,
  };
};
