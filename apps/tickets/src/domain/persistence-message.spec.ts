import { describe, expect, it } from 'vitest';

import { persistenceMessage, publicMessage } from './persistence-message.js';

describe('persistenceMessage', () => {
  it('traduce las claves duplicadas sin mostrar el código de la base', () => {
    expect(persistenceMessage({ code: 'P2002', meta: { target: ['code'] } })).toBe('Ya existe un área con esas siglas.');
    expect(persistenceMessage({ code: 'P2002', meta: { target: ['document'] } })).toBe('Ese DNI ya está registrado.');
    expect(persistenceMessage({ code: 'P2002', meta: { target: ['userId'] } })).toBe('Ese correo ya está registrado.');
    expect(persistenceMessage({ code: 'P2002', meta: { constraint: 'ticket_categories_areaId_name_key' } })).toBe('Ya existe una categoría con ese nombre en el área.');
    expect(persistenceMessage({ code: 'P2002', meta: { target: ['userId', 'areaId'] } })).toBe('Esa persona ya está inscrita en el área.');
  });

  it('oculta una violación de llave foránea', () => {
    expect(persistenceMessage({ code: 'P2003', message: 'Foreign key constraint failed on the field: `areaId`' })).toBe('No se puede completar porque el registro tiene información relacionada.');
  });

  it('ignora un error que no viene de la base', () => {
    expect(persistenceMessage(new Error('Selecciona al menos un área.'))).toBeNull();
  });
});

describe('publicMessage', () => {
  it('une varios avisos y reemplaza un código de PostgreSQL', () => {
    expect(publicMessage({ message: ['El DNI debe tener 8 dígitos.', 'Usa un correo institucional.'] })).toBe('El DNI debe tener 8 dígitos. Usa un correo institucional.');
    expect(publicMessage({ message: 'duplicate key value violates unique constraint "areas_code_key" (P2002)' })).toBe('Ya existe un área con esas siglas.');
    expect(publicMessage('SQLSTATE 23505')).toBe('No pudimos completar la operación. Inténtalo nuevamente.');
  });
});
