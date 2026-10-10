import { randomBytes } from 'node:crypto';
import { decrypt, encrypt, encryptedColumn } from './encryption';

describe('encryption', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
  });

  it('round-trips a value and does not store it in the clear', () => {
    const ciphertext = encrypt('123456789');

    expect(ciphertext).toMatch(/^v1:/);
    expect(ciphertext).not.toContain('123456789');
    expect(decrypt(ciphertext)).toBe('123456789');
  });

  it('produces a different ciphertext each time', () => {
    expect(encrypt('123456789')).not.toBe(encrypt('123456789'));
  });

  it('rejects a tampered ciphertext', () => {
    const [version, iv, tag] = encrypt('123456789').split(':');
    const forged = [version, iv, tag, Buffer.from('000000000').toString('base64')].join(':');

    expect(() => decrypt(forged)).toThrow();
  });

  it('passes through nulls and rows written before encryption', () => {
    expect(encryptedColumn.to(null)).toBeNull();
    expect(encryptedColumn.from(null)).toBeNull();
    expect(encryptedColumn.from('123456789')).toBe('123456789');
  });
});
