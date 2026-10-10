// Matched on snake_case token boundaries, otherwise "ssn" hits `businessName`.
export const SENSITIVE_PATTERNS: RegExp[] = [
  /pass(word|phrase)?/,
  /token/,
  /secret/,
  /(^|_)api_?key(_|$)/,
  /authorization/,
  /(^|_)tax_?id(_|$)/,
  /(^|_)ssn(_|$)/,
  /(account|routing|card)_?number/,
  /(^|_)cvv(_|$)/,
];

export const REDACTED = '[REDACTED]';

const toSnakeCase = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase();

const isSensitive = (key: string): boolean => {
  const normalized = toSnakeCase(key);
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
};

// Deep copy with sensitive leaves replaced.
export function redact(value: unknown, depth = 0): unknown {
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

// Keeps the last few characters only, e.g. `***6789`.
export function maskTail(value: string | null | undefined, visible = 4): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= visible) {
    return '*'.repeat(value.length);
  }
  return `${'*'.repeat(Math.min(value.length - visible, 8))}${value.slice(-visible)}`;
}
