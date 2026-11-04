export type OperableStatus = 'CREATED' | 'IN_REVIEW' | 'RETURNED' | 'RESOLVED' | 'DERIVED' | 'REOPENED';

const NEXT: Readonly<Record<string, readonly OperableStatus[]>> = {
  CREATED: ['IN_REVIEW'],
  REOPENED: ['IN_REVIEW'],
  IN_REVIEW: ['RETURNED', 'RESOLVED', 'DERIVED'],
};

export const nextStatuses = (current: string): readonly OperableStatus[] => NEXT[current] ?? [];

export const statusChangeError = (
  current: string,
  next: string,
  note: string,
  assignedName: string,
): string | null => {
  if (current === next) return 'Ese estado ya está registrado.';
  if (!nextStatuses(current).includes(next as OperableStatus)) {
    return 'Esa transición de estado no está permitida.';
  }
  if (next === 'DERIVED' && !assignedName.trim()) return 'Indica a quién se deriva el ticket.';
  if ((next === 'DERIVED' || next === 'RESOLVED' || next === 'RETURNED') && note.trim().length < 5) {
    return 'El comentario es obligatorio para este estado.';
  }
  return null;
};
