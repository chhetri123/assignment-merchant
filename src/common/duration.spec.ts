import { durationToSeconds } from './duration';

describe('durationToSeconds', () => {
  it('converts each supported unit', () => {
    expect(durationToSeconds('45s')).toBe(45);
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('2h')).toBe(7200);
    expect(durationToSeconds('7d')).toBe(604800);
  });

  it('rejects anything it cannot parse, instead of guessing', () => {
    expect(() => durationToSeconds('15 minutes')).toThrow(/Invalid duration/);
    expect(() => durationToSeconds('900')).toThrow(/Invalid duration/);
    expect(() => durationToSeconds('')).toThrow(/Invalid duration/);
  });
});
