import { describe, expect, it } from 'vitest';

import { openTotpSecret, sealTotpSecret, verifyTotp } from './totp.js';

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp', () => {
  it('acepta los vectores de 6 dígitos del RFC 6238', () => {
    expect(verifyTotp(RFC_SECRET, '287082', 59_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '081804', 1_111_111_109_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '050471', 1_111_111_111_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '005924', 1_234_567_890_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '279037', 2_000_000_000_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '000000', 59_000)).toBe(false);
  });

  it('recupera el secreto cifrado', () => {
    const sealed = sealTotpSecret(RFC_SECRET, 'clave-de-prueba-con-32-caracteres');
    expect(openTotpSecret(sealed, 'clave-de-prueba-con-32-caracteres')).toBe(RFC_SECRET);
    expect(() => openTotpSecret(sealed, 'otra-clave-de-prueba-distinta-32')).toThrow();
  });
});
