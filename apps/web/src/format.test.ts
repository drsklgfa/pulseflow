import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';

describe('formatMoney', () => {
  it('formats minor units as BRL', () => {
    expect(formatMoney(12990)).toContain('129,90');
  });
});
