const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export const DURATION_PATTERN = /^(\d+)([smhd])$/;

// Converts a duration such as `15m` into seconds. JWT and Redis both want a
// number, so durations are resolved once at config load.
export function durationToSeconds(duration: string): number {
  const match = DURATION_PATTERN.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration "${duration}", expected a value like 15m, 2h or 7d`);
  }

  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit];
}
