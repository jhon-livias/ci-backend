import { describe, expect, it } from 'vitest';

import { createHealthController } from './health.controller.js';

describe('createHealthController', () => {
  it('returns the service health without exposing implementation details', () => {
    const HealthController = createHealthController('payments');
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({ service: 'payments', status: 'ok' });
  });
});
