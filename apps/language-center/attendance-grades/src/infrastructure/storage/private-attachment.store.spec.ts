import { describe, expect, it } from 'vitest';

import { PrivateAttachmentStore } from './private-attachment.store.js';

describe('PrivateAttachmentStore', () => {
  it('rejects unsupported attachment types', async () => {
    const store = new PrivateAttachmentStore();
    await expect(store.save({ name: 'sustento.exe', contentType: 'application/octet-stream', base64: 'dGVzdA==' })).rejects.toThrow('PDF, JPG o PNG');
  });

  it('rejects attachments over five megabytes before storage', async () => {
    const store = new PrivateAttachmentStore();
    await expect(store.save({ name: 'sustento.pdf', contentType: 'application/pdf', base64: 'A'.repeat(7_000_000) })).rejects.toThrow('supera 5 MB');
  });
});
