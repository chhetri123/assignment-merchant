import { REDACTED, maskTail, redact } from './redact';

describe('redact', () => {
  it('replaces credentials and identifiers at any depth', () => {
    const input = {
      email: 'sales@merchant.test',
      password: 'ChangeMe123!',
      refreshToken: 'ey.header.payload',
      nested: { ownerTaxId: '123456789', accountNumber: '000123456' },
      list: [{ cvv: '123' }],
    };

    expect(redact(input)).toEqual({
      email: 'sales@merchant.test',
      password: REDACTED,
      refreshToken: REDACTED,
      nested: { ownerTaxId: REDACTED, accountNumber: REDACTED },
      list: [{ cvv: REDACTED }],
    });
  });

  it('keeps keys that only look sensitive', () => {
    // "ssn" appears inside "businessName" as a substring.
    expect(redact({ businessName: 'Himalaya Coffee', legalBusinessName: 'Himalaya Ltd' })).toEqual({
      businessName: 'Himalaya Coffee',
      legalBusinessName: 'Himalaya Ltd',
    });
  });

  it('leaves non-object values alone', () => {
    expect(redact(undefined)).toBeUndefined();
    expect(redact('plain')).toBe('plain');
  });
});

describe('maskTail', () => {
  it('shows only the last four characters', () => {
    expect(maskTail('123456789')).toBe('*****6789');
    expect(maskTail('12')).toBe('**');
    expect(maskTail(null)).toBeNull();
  });
});
