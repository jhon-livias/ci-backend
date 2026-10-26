import { randomInt } from 'node:crypto';

const NAME = /^[^<>]{1,100}$/u;
const EMAIL = /^[^\s<>]{1,64}@[^\s<>]{1,188}\.[^\s<>]{2,20}$/u;
const DNI = /^\d{8}$/u;
const FOREIGN_DOCUMENT = /^[A-Za-z0-9]{6,12}$/u;
const PHONE = /^[0-9+\s()-]{6,30}$/u;
const MOBILE = /^\d{6,15}$/u;
const PASSWORD = /^[^<>]{8,72}$/u;
const TEMPORARY_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const TEMPORARY_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEMPORARY_DIGITS = '23456789';
const TEMPORARY_SYMBOLS = '@#.';
const PERMISSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const FUNCTIONALITY = /^[^<>]{1,120}$/u;

export const MOBILE_COUNTRIES = ['+51', '+1', '+52', '+54', '+56', '+57', '+58', '+593', '+34'] as const;
export const DOCUMENT_TYPES = ['DNI', 'CE', 'PASSPORT'] as const;

export class UserAccountRuleError extends Error {
  constructor(readonly rule: 'name' | 'document' | 'contact' | 'password' | 'site' | 'permission') {
    super(rule);
  }
}

export interface UserGrantDraft {
  readonly permissionId: string;
  readonly name: string;
  readonly enabled: boolean;
}

export interface NormalizedUserAccount {
  readonly documentType: (typeof DOCUMENT_TYPES)[number];
  readonly documentNumber: string;
  readonly firstName: string;
  readonly paternalLastName: string;
  readonly maternalLastName: string;
  readonly siteId: string;
  readonly phone: string | null;
  readonly mobileCountry: (typeof MOBILE_COUNTRIES)[number];
  readonly mobile: string;
  readonly email: string;
  readonly password: string | null;
  readonly enabled: boolean;
  readonly grants: readonly UserGrantDraft[];
}

const clean = (value: string): string => value.trim();

const pickTemporary = (alphabet: string): string => alphabet[randomInt(alphabet.length)] ?? 'a';

export const temporaryPassword = (): string => {
  const chars = [
    pickTemporary(TEMPORARY_LOWER), pickTemporary(TEMPORARY_LOWER), pickTemporary(TEMPORARY_LOWER),
    pickTemporary(TEMPORARY_UPPER), pickTemporary(TEMPORARY_UPPER),
    pickTemporary(TEMPORARY_DIGITS), pickTemporary(TEMPORARY_DIGITS),
    pickTemporary(TEMPORARY_SYMBOLS), pickTemporary(TEMPORARY_SYMBOLS),
  ];
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    const current = chars[index] ?? 'a';
    chars[index] = chars[swap] ?? 'a';
    chars[swap] = current;
  }
  return chars.join('');
};

export const normalizeUserAccount = (input: {
  readonly documentType: string;
  readonly documentNumber: string;
  readonly firstName: string;
  readonly paternalLastName: string;
  readonly maternalLastName: string;
  readonly siteId: string;
  readonly phone?: string;
  readonly mobileCountry: string;
  readonly mobile: string;
  readonly email: string;
  readonly password?: string;
  readonly enabled: boolean;
  readonly grants: readonly { readonly permissionId: string; readonly name: string; readonly enabled: boolean }[];
}, requirePassword: boolean): NormalizedUserAccount => {
  const firstName = clean(input.firstName);
  const paternalLastName = clean(input.paternalLastName);
  const maternalLastName = clean(input.maternalLastName);
  if (!NAME.test(firstName) || !NAME.test(paternalLastName) || !NAME.test(maternalLastName)) throw new UserAccountRuleError('name');
  if (!DOCUMENT_TYPES.includes(input.documentType as (typeof DOCUMENT_TYPES)[number])) throw new UserAccountRuleError('document');
  const documentType = input.documentType as (typeof DOCUMENT_TYPES)[number];
  const documentNumber = clean(input.documentNumber);
  if (documentType === 'DNI' ? !DNI.test(documentNumber) : !FOREIGN_DOCUMENT.test(documentNumber)) throw new UserAccountRuleError('document');

  const email = clean(input.email).toLowerCase();
  if (!EMAIL.test(email)) throw new UserAccountRuleError('contact');
  const phone = clean(input.phone ?? '');
  if (phone && !PHONE.test(phone)) throw new UserAccountRuleError('contact');
  if (!MOBILE_COUNTRIES.includes(input.mobileCountry as (typeof MOBILE_COUNTRIES)[number])) throw new UserAccountRuleError('contact');
  const mobile = clean(input.mobile);
  if (!MOBILE.test(mobile)) throw new UserAccountRuleError('contact');

  const password = clean(input.password ?? '');
  if (requirePassword && !password) throw new UserAccountRuleError('password');
  if (password && !PASSWORD.test(password)) throw new UserAccountRuleError('password');
  if (!PERMISSION_ID.test(input.siteId)) throw new UserAccountRuleError('site');
  if (input.grants.length < 1 || input.grants.length > 200) throw new UserAccountRuleError('permission');

  const seen = new Set<string>();
  const grants = input.grants.map((item) => {
    const permissionId = item.permissionId.toLowerCase();
    const name = clean(item.name);
    const key = `${permissionId}:${name.toLocaleLowerCase('es')}`;
    if (!PERMISSION_ID.test(permissionId) || !FUNCTIONALITY.test(name) || seen.has(key)) throw new UserAccountRuleError('permission');
    seen.add(key);
    return { permissionId, name, enabled: item.enabled };
  });
  if (!grants.some((item) => item.enabled)) throw new UserAccountRuleError('permission');

  return {
    documentType,
    documentNumber,
    firstName,
    paternalLastName,
    maternalLastName,
    siteId: input.siteId.toLowerCase(),
    phone: phone || null,
    mobileCountry: input.mobileCountry as (typeof MOBILE_COUNTRIES)[number],
    mobile,
    email,
    password: password || null,
    enabled: input.enabled,
    grants,
  };
};
