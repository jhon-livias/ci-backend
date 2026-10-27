import { randomInt } from 'node:crypto';

import { normalizeInstitutionalEmail } from './institutional-email.js';

const NAME = /^[^<>]{1,100}$/u;
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
  constructor(readonly rule: 'name' | 'document' | 'contact' | 'email' | 'password' | 'site' | 'permission') {
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
  if (!NAME.test(firstName) || !NAME.test(paternalLastName)) throw new UserAccountRuleError('name');
  if (requirePassword ? !NAME.test(maternalLastName) : maternalLastName.length > 0 && !NAME.test(maternalLastName)) throw new UserAccountRuleError('name');
  if (!DOCUMENT_TYPES.includes(input.documentType as (typeof DOCUMENT_TYPES)[number])) throw new UserAccountRuleError('document');
  const documentType = input.documentType as (typeof DOCUMENT_TYPES)[number];
  const documentNumber = clean(input.documentNumber);
  if (documentType === 'DNI' ? !DNI.test(documentNumber) : !FOREIGN_DOCUMENT.test(documentNumber)) throw new UserAccountRuleError('document');

  const email = normalizeInstitutionalEmail(input.email);
  if (!email) throw new UserAccountRuleError('email');
  const phone = clean(input.phone ?? '');
  if (phone && !PHONE.test(phone)) throw new UserAccountRuleError('contact');
  const mobileCountry = input.mobileCountry;
  const mobile = clean(input.mobile);
  if (mobile && !MOBILE_COUNTRIES.includes(mobileCountry as (typeof MOBILE_COUNTRIES)[number])) throw new UserAccountRuleError('contact');
  if (requirePassword && !MOBILE_COUNTRIES.includes(mobileCountry as (typeof MOBILE_COUNTRIES)[number])) throw new UserAccountRuleError('contact');
  if (mobile && !MOBILE.test(mobile)) throw new UserAccountRuleError('contact');
  if (requirePassword && !MOBILE.test(mobile)) throw new UserAccountRuleError('contact');

  const password = clean(input.password ?? '');
  if (requirePassword && !password) throw new UserAccountRuleError('password');
  if (password && !PASSWORD.test(password)) throw new UserAccountRuleError('password');
  const siteId = clean(input.siteId);
  if (siteId && !PERMISSION_ID.test(siteId)) throw new UserAccountRuleError('site');
  if (requirePassword && !PERMISSION_ID.test(siteId)) throw new UserAccountRuleError('site');
  const incomingGrants = input.grants ?? [];
  if (requirePassword && (incomingGrants.length < 1 || incomingGrants.length > 200)) throw new UserAccountRuleError('permission');
  if (!requirePassword && incomingGrants.length > 200) throw new UserAccountRuleError('permission');

  const seen = new Set<string>();
  const grants = incomingGrants.map((item) => {
    const permissionId = item.permissionId.toLowerCase();
    const name = clean(item.name);
    const key = `${permissionId}:${name.toLocaleLowerCase('es')}`;
    if (!PERMISSION_ID.test(permissionId) || !FUNCTIONALITY.test(name) || seen.has(key)) throw new UserAccountRuleError('permission');
    seen.add(key);
    return { permissionId, name, enabled: item.enabled };
  });
  if (requirePassword && !grants.some((item) => item.enabled)) throw new UserAccountRuleError('permission');
  if (!requirePassword && grants.length > 0 && !grants.some((item) => item.enabled)) throw new UserAccountRuleError('permission');

  return {
    documentType,
    documentNumber,
    firstName,
    paternalLastName,
    maternalLastName,
    siteId: siteId.toLowerCase(),
    phone: phone || null,
    mobileCountry: mobile ? mobileCountry as (typeof MOBILE_COUNTRIES)[number] : '+51',
    mobile,
    email,
    password: password || null,
    enabled: input.enabled,
    grants,
  };
};
