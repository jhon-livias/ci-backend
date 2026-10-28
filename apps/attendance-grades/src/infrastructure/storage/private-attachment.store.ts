import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export type PrivateAttachment = { readonly key: string; readonly name: string; readonly contentType: string; readonly sizeBytes: number };

@Injectable()
export class PrivateAttachmentStore implements OnModuleInit {
  private readonly root = resolve(process.env.ATTACHMENTS_DIR ?? '/var/lib/ci-attachments');
  async onModuleInit(): Promise<void> { await mkdir(this.root, { recursive: true }); }

  async save(input: { readonly name: string; readonly contentType: string; readonly base64: string }): Promise<PrivateAttachment> {
    if (!ALLOWED.has(input.contentType) || !/^[^<>\\/:*?"|]{1,160}$/u.test(input.name)) throw new BadRequestException('El archivo debe ser PDF, JPG o PNG.');
    if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(input.base64) || input.base64.length > Math.ceil(MAX_BYTES * 4 / 3) + 4) throw new BadRequestException('El archivo no es válido o supera 5 MB.');
    const data = Buffer.from(input.base64, 'base64');
    if (!data.length || data.length > MAX_BYTES) throw new BadRequestException('El archivo no es válido o supera 5 MB.');
    const key = randomUUID(); await writeFile(join(this.root, key), data, { flag: 'wx' });
    return { key, name: input.name, contentType: input.contentType, sizeBytes: data.length };
  }
  async read(key: string): Promise<Buffer> {
    if (!/^[0-9a-f-]{36}$/u.test(key)) throw new BadRequestException('Archivo no válido.');
    return readFile(join(this.root, key));
  }
}
