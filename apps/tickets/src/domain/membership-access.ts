export interface MembershipArea {
  readonly areaId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly canCreateTickets: boolean;
  readonly receivesTickets: boolean;
}

export const accessFromMemberships = (areas: readonly MembershipArea[]): {
  readonly enrolled: boolean;
  readonly canCreateTickets: boolean;
  readonly receivesTickets: boolean;
} => ({
  enrolled: areas.length > 0,
  canCreateTickets: areas.some((area) => area.enabled && area.canCreateTickets),
  receivesTickets: areas.some((area) => area.enabled && area.receivesTickets),
});

export type CreateDecision =
  | { readonly allowed: true; readonly originName: string | null }
  | { readonly allowed: false; readonly reason: 'forbidden' | 'origin' };

/** Quien no está inscrito conserva el alta libre. Quien sí lo está solo crea desde un área habilitada. */
export const decideCreate = (areas: readonly MembershipArea[], originAreaId?: string): CreateDecision => {
  if (areas.length === 0) return { allowed: true, originName: null };
  const creatable = areas.filter((area) => area.enabled && area.canCreateTickets);
  if (creatable.length === 0) return { allowed: false, reason: 'forbidden' };
  const origin = creatable.find((area) => area.areaId === originAreaId);
  if (!origin) return { allowed: false, reason: 'origin' };
  return { allowed: true, originName: origin.name };
};

export type TicketScope =
  | { readonly type: 'all' }
  | { readonly type: 'own' }
  | { readonly type: 'queue'; readonly areaIds: readonly string[] }
  | { readonly type: 'own-or-queue'; readonly areaIds: readonly string[] }
  | { readonly type: 'none' };

export const ticketScope = (
  role: 'requester' | 'assistant' | 'area_manager' | 'admin',
  areas: readonly MembershipArea[],
): TicketScope => {
  if (role === 'admin' || areas.length === 0 && role !== 'requester') return { type: 'all' };
  if (areas.length === 0) return { type: 'own' };
  const access = accessFromMemberships(areas);
  const areaIds = areas.filter((area) => area.enabled && area.receivesTickets).map((area) => area.areaId);
  if (access.canCreateTickets && access.receivesTickets) return { type: 'own-or-queue', areaIds };
  if (access.receivesTickets) return { type: 'queue', areaIds };
  if (access.canCreateTickets) return { type: 'own' };
  return { type: 'none' };
};

export const canOperateArea = (
  role: 'requester' | 'assistant' | 'area_manager' | 'admin',
  areas: readonly MembershipArea[],
  areaId: string,
): boolean => {
  if (role === 'requester') return false;
  if (role === 'admin' || areas.length === 0) return true;
  return areas.some((area) => area.areaId === areaId && area.enabled && area.receivesTickets);
};
