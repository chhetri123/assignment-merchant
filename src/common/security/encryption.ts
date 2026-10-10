import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ValueTransformer } from 'typeorm';

// Applied to ownerTaxId today. Bank account/routing numbers and KYB identity
// documents need the same treatment when those fields are added; card data
// must be tokenized at the gateway, never stored.
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters');
  }
  return Buffer.from(hex, 'hex');
}

// Stored as v1:iv:tag:ciphertext, all base64.
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decrypt(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(':');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Value is not in the expected encrypted format');
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export const encryptedColumn: ValueTransformer = {
  to: (value: string | null) => (value == null ? value : encrypt(value)),
  // Rows written before encryption was introduced are returned as-is.
  from: (value: string | null) =>
    value == null || !value.startsWith(`${VERSION}:`) ? value : decrypt(value),
};
