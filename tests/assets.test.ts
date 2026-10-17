import { describe, expect, it } from 'vitest';
import { AmountError, formatUnits, parseUnits } from '../lib/assets';

describe('parseUnits', () => {
  it('turns decimals into base units exactly', () => {
    expect(parseUnits('1', 18)).toBe(10n ** 18n);
    expect(parseUnits('0.25', 18)).toBe(250_000_000_000_000_000n);
    expect(parseUnits('12.5', 6)).toBe(12_500_000n);
    expect(parseUnits('0.000001', 6)).toBe(1n);
    expect(parseUnits(' 3 ', 6)).toBe(3_000_000n);
  });

  it.each(['', ' ', '-1', '1e3', '1,5', 'abc', '.5', '5.', '0x10', '1.2.3', '0', '0.0'])('rejects "%s"', (text) => {
    expect(() => parseUnits(text, 6)).toThrow(AmountError);
  });

  it('rejects more decimal places than the asset has', () => {
    expect(() => parseUnits('0.0000001', 6)).toThrow(/at most 6/);
  });

  it('has no float error', () => {
    expect(parseUnits('0.1', 18) + parseUnits('0.2', 18)).toBe(parseUnits('0.3', 18));
  });
});

describe('formatUnits', () => {
  it('formats with grouping and cuts instead of rounding up', () => {
    expect(formatUnits('1234567890000', 6, 2)).toBe('1,234,567.89');
    expect(formatUnits('999999', 6, 2)).toBe('0.99'); // 0.999999 must not show as 1.00
    expect(formatUnits('0', 18, 6)).toBe('0.000000');
    expect(formatUnits(10n ** 18n, 18, 6)).toBe('1.000000');
    expect(formatUnits('-1500000', 6, 2)).toBe('-1.50');
  });

  it('round-trips with parseUnits', () => {
    for (const t of ['0.25', '1', '1234.5']) expect(formatUnits(parseUnits(t, 18), 18, 18).replace(/\.?0+$/, '').replace(/,/g, '')).toBe(t);
  });
});
