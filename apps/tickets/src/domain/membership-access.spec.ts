import { describe, expect, it } from 'vitest';

import { accessFromMemberships, canOperateArea, decideCreate, ticketScope, type MembershipArea } from './membership-access.js';

const area = (partial: Partial<MembershipArea> & Pick<MembershipArea, 'areaId'>): MembershipArea => ({
  name: partial.areaId,
  enabled: true,
  canCreateTickets: false,
  receivesTickets: false,
  ...partial,
});

describe('accessFromMemberships', () => {
  it('habilita crear y recibir según las áreas inscritas', () => {
    const access = accessFromMemberships([
      area({ areaId: 'a', canCreateTickets: true }),
      area({ areaId: 'b', receivesTickets: true }),
      area({ areaId: 'c', enabled: false, canCreateTickets: true, receivesTickets: true }),
    ]);
    expect(access).toEqual({ enrolled: true, canCreateTickets: true, receivesTickets: true });
  });

  it('no abre módulos si la persona no está inscrita', () => {
    expect(accessFromMemberships([])).toEqual({ enrolled: false, canCreateTickets: false, receivesTickets: false });
  });
});

describe('decideCreate', () => {
  it('exige un área propia habilitada para crear cuando la persona está inscrita', () => {
    const areas = [area({ areaId: 'rrhh', name: 'Recursos Humanos', canCreateTickets: true })];
    expect(decideCreate(areas)).toEqual({ allowed: false, reason: 'origin' });
    expect(decideCreate(areas, 'rrhh')).toEqual({ allowed: true, originName: 'Recursos Humanos' });
    expect(decideCreate([area({ areaId: 'ti', receivesTickets: true })], 'ti')).toEqual({ allowed: false, reason: 'forbidden' });
  });

  it('deja crear a quien todavía no tiene áreas inscritas', () => {
    expect(decideCreate([])).toEqual({ allowed: true, originName: null });
  });
});

describe('ticketScope', () => {
  it('limita la cola a las áreas que reciben y los propios tickets a quien crea', () => {
    const areas = [
      area({ areaId: 'rrhh', canCreateTickets: true }),
      area({ areaId: 'ti', receivesTickets: true }),
    ];
    expect(ticketScope('assistant', areas)).toEqual({ type: 'own-or-queue', areaIds: ['ti'] });
    expect(ticketScope('assistant', [area({ areaId: 'rrhh', canCreateTickets: true })])).toEqual({ type: 'own' });
    expect(ticketScope('assistant', [area({ areaId: 'ti', receivesTickets: true })])).toEqual({ type: 'queue', areaIds: ['ti'] });
    expect(ticketScope('requester', [])).toEqual({ type: 'own' });
    expect(ticketScope('assistant', [])).toEqual({ type: 'all' });
  });
});

describe('canOperateArea', () => {
  it('solo deja cambiar estado en un área inscrita que recibe tickets', () => {
    const areas = [area({ areaId: 'ti', receivesTickets: true }), area({ areaId: 'rrhh', canCreateTickets: true })];
    expect(canOperateArea('assistant', areas, 'ti')).toBe(true);
    expect(canOperateArea('assistant', areas, 'rrhh')).toBe(false);
    expect(canOperateArea('requester', areas, 'ti')).toBe(false);
    expect(canOperateArea('admin', areas, 'rrhh')).toBe(true);
  });
});
