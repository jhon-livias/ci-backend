import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PasswordRecoveryService } from './password-recovery.service.js';

describe('PasswordRecoveryService', () => {
  const findFirst = vi.fn();
  const create = vi.fn();
  const deleteToken = vi.fn();
  const updateMany = vi.fn();
  const findMany = vi.fn();
  const send = vi.fn();
  const transaction = vi.fn();
  const userUpdate = vi.fn();
  const sessionUpdate = vi.fn();

  const service = new PasswordRecoveryService(
    {
      user: { findFirst, update: userUpdate },
      passwordResetToken: { create, delete: deleteToken, updateMany, findMany },
      authSession: { updateMany: sessionUpdate },
      $transaction: transaction,
    } as never,
    { enabled: true, send } as never,
    null,
  );

  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
    deleteToken.mockReset();
    updateMany.mockReset();
    findMany.mockReset();
    send.mockReset();
    transaction.mockReset();
    userUpdate.mockReset();
    sessionUpdate.mockReset();
    create.mockResolvedValue({ id: 'token-1' });
    updateMany.mockResolvedValue({ count: 0 });
    send.mockResolvedValue(undefined);
  });

  it('sends a code only when the institutional account exists', async () => {
    await service.request('persona@gmail.com');
    expect(findFirst).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();

    findFirst.mockResolvedValue({ id: 'user-1' });
    await service.request('admin@uprit.edu.pe');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@uprit.edu.pe',
      subject: 'Código para restablecer tu contraseña',
    }));
    expect(send.mock.calls[0]?.[0].text).toMatch(/Código: \d{8}/);
    expect(send.mock.calls[0]?.[0].text).not.toContain('Solo se acepta');
  });

  it('answers the same way when the code does not match', async () => {
    findFirst.mockResolvedValue({ id: 'user-1' });
    findMany.mockResolvedValue([{ id: 'token-1', tokenHash: await argon2.hash('87654321', { type: argon2.argon2id }) }]);
    await expect(service.confirm('admin@uprit.edu.pe', '12345678', 'clave-segura')).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
