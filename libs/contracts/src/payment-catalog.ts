export class PaymentCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentCatalogError';
  }
}

const MAX_CENTS = 9_999_999;

export const parseSoles = (value: string): number => {
  const text = value.trim();
  if (!/^\d{1,5}(?:\.\d{1,2})?$/u.test(text)) throw new PaymentCatalogError('El monto no es válido.');
  const [integer, fraction = ''] = text.split('.');
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_CENTS) throw new PaymentCatalogError('El monto no es válido.');
  return cents;
};

export const formatSoles = (cents: number): string => {
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_CENTS) throw new PaymentCatalogError('El monto no es válido.');
  return (cents / 100).toFixed(2);
};

export const normalizeAmountCents = (cents: number): number => {
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_CENTS) throw new PaymentCatalogError('El monto no es válido.');
  return cents;
};
