export type TicketsRole = 'requester' | 'assistant' | 'area_manager' | 'admin';

const RANK: readonly TicketsRole[] = ['admin', 'area_manager', 'assistant', 'requester'];

const USERNAME_FALLBACK: Readonly<Record<string, TicketsRole>> = {
  administrador: 'admin',
  'jefe-area': 'area_manager',
  asistente: 'assistant',
  solicitante: 'requester',
};

const fromCode = (value: string): TicketsRole | null => {
  if (value === 'tickets.admin' || value === 'admin' || value === 'administrador') return 'admin';
  if (value === 'tickets.area_manager' || value === 'area_manager' || value === 'jefe-area') return 'area_manager';
  if (value === 'tickets.assistant' || value === 'assistant' || value === 'asistente') return 'assistant';
  if (value === 'tickets.requester' || value === 'requester' || value === 'solicitante') return 'requester';
  return null;
};

export const resolveTicketsRole = (roles: readonly string[], username: string): TicketsRole => {
  const resolved = roles
    .map(fromCode)
    .filter((role): role is TicketsRole => role !== null)
    .sort((left, right) => RANK.indexOf(left) - RANK.indexOf(right))[0];
  return resolved ?? USERNAME_FALLBACK[username.toLocaleLowerCase('es')] ?? 'requester';
};

export const canManageCatalog = (role: TicketsRole): boolean => role === 'admin';
export const canManageTeam = (role: TicketsRole): boolean => role === 'area_manager' || role === 'admin';
export const canOperateQueue = (role: TicketsRole): boolean =>
  role === 'assistant' || role === 'area_manager' || role === 'admin';
export const canCreateInternal = (role: TicketsRole): boolean => role === 'area_manager' || role === 'admin';
