// Decorators are evaluated at import time and cannot read ConfigService, so
// the limits are parsed here and reused by both the module and the decorator.
const toInt = (value: string | undefined, fallback: number): number =>
  value === undefined ? fallback : parseInt(value, 10);

export const RATE_TTL_SECONDS = toInt(process.env.THROTTLE_TTL_SECONDS, 60);
export const DEFAULT_RATE_LIMIT = toInt(process.env.THROTTLE_LIMIT, 120);
export const AUTH_RATE_LIMIT = toInt(process.env.THROTTLE_AUTH_LIMIT, 10);
export const AUTH_RATE_TTL_MS = RATE_TTL_SECONDS * 1000;
