import { describe, expect, it } from 'vitest';

import { PaymentCatalogError, formatSoles, parseSoles } from './payment-catalog.js';

describe('payment catalog amounts', () => {
  it('stores soles as cents', () => {
    expect(parseSoles('230')).toBe(23000);
    expect(parseSoles('450.50')).toBe(45050);
    expect(formatSoles(23000)).toBe('230.00');
  });

  it('rejects a markup amount', () => {
    expect(() => parseSoles('<230>')).toThrow(PaymentCatalogError);
  });
});
