import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { describe, expect, it } from 'vitest';
import { InternalSitesGuard } from './sites.controller.js';

describe('internal sites guard', () => {
  it('fails closed without an internal credential', () => {
    expect(() => new InternalSitesGuard().canActivate(new ExecutionContextHost([{ headers: {} }]))).toThrow(UnauthorizedException);
  });
});
