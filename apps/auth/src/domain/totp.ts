import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const generateTotpSecret = (): string => encodeBase32(randomBytes(20));

export const totpKeyUri = (secret: string, account: string): string => {
  const label = encodeURIComponent(`Identidad UPRIT:${account}`);
  const issuer = encodeURIComponent('Identidad UPRIT');
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
};

export const verifyTotp = (secret: string, code: string, now = Date.now()): boolean => {
  if (!/^\d{6}$/.test(code)) return false;
  const step = Math.floor(now / 30_000);
  return [-1, 0, 1].some((offset) => sameCode(hotp(secret, step + offset), code));
};

export const sealTotpSecret = (secret: string, keyMaterial: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(keyMaterial), iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
};

export const openTotpSecret = (sealed: string, keyMaterial: string): string => {
  const payload = Buffer.from(sealed, 'base64url');
  if (payload.length < 29) throw new Error('secreto inválido');
  const decipher = createDecipheriv('aes-256-gcm', key(keyMaterial), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
};

const key = (material: string): Buffer => createHash('sha256').update(material).digest();

const sameCode = (left: string, right: string): boolean =>
  left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));

const hotp = (secret: string, counter: number): string => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
};

export const encodeBase32 = (value: Buffer): string => {
  let bits = 0;
  let buffer = 0;
  let out = '';
  for (const byte of value) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
};

const decodeBase32 = (value: string): Buffer => {
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const char of value.replace(/=+$/u, '').toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('secreto inválido');
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
};
