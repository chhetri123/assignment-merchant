import { isPositiveAmount, toMinorUnits } from './money';

describe('money', () => {
  it('converts decimal strings to minor units without float error', () => {
    expect(toMinorUnits('25000.50')).toBe(2500050n);
    expect(toMinorUnits('0.07')).toBe(7n);
    expect(toMinorUnits('10')).toBe(1000n);
    expect(toMinorUnits('1.1')).toBe(110n);
  });

  it('keeps precision a float would lose', () => {
    // 0.1 + 0.2 !== 0.3 in floating point; in minor units it is exact.
    expect(toMinorUnits('0.10') + toMinorUnits('0.20')).toBe(toMinorUnits('0.30'));
    expect(toMinorUnits('999999999999.99')).toBe(99999999999999n);
  });

  it('rejects amounts that are not positive or not well formed', () => {
    expect(isPositiveAmount('0.00')).toBe(false);
    expect(isPositiveAmount('-5.00')).toBe(false);
    expect(isPositiveAmount('1.234')).toBe(false);
    expect(isPositiveAmount('abc')).toBe(false);
    expect(isPositiveAmount('25000.50')).toBe(true);
  });
});
