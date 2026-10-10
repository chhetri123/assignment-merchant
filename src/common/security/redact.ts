// Matched case-insensitively as substrings, so `taxid` covers `ownerTaxId` too.
export const SENSITIVE_KEYS = [
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'apikey',
  'taxid',
  'tax_id',
  'ssn',
  'accountnumber',
  'routingnumber',
  'cardnumber',
  'cvv',
];

export const REDACTED = '[REDACTED]';

const isSensitive = (key: string): boolean => {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
};

// Deep copy with sensitive leaves replaced. Depth-capped to keep logs readable.
export function redact<T>(value: T, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, val]) => {
        acc[key] = isSensitive(key) ? REDACTED : redact(val, depth + 1);
        return acc;
      },
      {},
    );
  }

  return value;
}

// Keeps only the last `visible` characters, e.g. `***6789`.
export function maskTail(value: string | null | undefined, visible = 4): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= visible) {
    return '*'.repeat(value.length);
  }
  return `${'*'.repeat(Math.min(value.length - visible, 8))}${value.slice(-visible)}`;
}
