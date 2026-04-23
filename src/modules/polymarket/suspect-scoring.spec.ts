import {
  computeSuspectScore,
  evalNewWallet,
  evalBuyOnly,
  evalPositionValue,
  evalConviction,
} from './suspect-scoring';

describe('computeSuspectScore', () => {
  it('returns 100 when all criteria pass', () => {
    expect(computeSuspectScore(true, true, true, true)).toBe(100);
  });

  it('returns 0 when all criteria fail', () => {
    expect(computeSuspectScore(false, false, false, false)).toBe(0);
  });

  it('returns 0 when all criteria are null', () => {
    expect(computeSuspectScore(null, null, null, null)).toBe(0);
  });

  it('returns 70 for new-wallet + buy-only only', () => {
    expect(computeSuspectScore(true, true, false, false)).toBe(70);
  });

  it('returns 35 for new-wallet only', () => {
    expect(computeSuspectScore(true, false, false, false)).toBe(35);
  });

  it('returns 35 for buy-only only', () => {
    expect(computeSuspectScore(false, true, false, false)).toBe(35);
  });

  it('returns 30 for position-value + conviction only', () => {
    expect(computeSuspectScore(false, false, true, true)).toBe(30);
  });

  it('treats null the same as false for scoring', () => {
    expect(computeSuspectScore(true, null, null, null)).toBe(35);
  });
});

describe('evalNewWallet', () => {
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

  it('passes when wallet created 1 day before closeTime', () => {
    const closeTime = 1_000_000_000_000;
    const createdAt = new Date(
      closeTime - 1 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(evalNewWallet(createdAt, closeTime)).toBe(true);
  });

  it('passes when wallet created exactly 5 days before closeTime', () => {
    const closeTime = 1_000_000_000_000;
    const createdAt = new Date(closeTime - FIVE_DAYS_MS).toISOString();
    expect(evalNewWallet(createdAt, closeTime)).toBe(true);
  });

  it('fails when wallet created 6 days before closeTime', () => {
    const closeTime = 1_000_000_000_000;
    const createdAt = new Date(
      closeTime - 6 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(evalNewWallet(createdAt, closeTime)).toBe(false);
  });

  it('returns null when createdAt is null', () => {
    expect(evalNewWallet(null, 1_000_000_000_000)).toBeNull();
  });
});

describe('evalBuyOnly', () => {
  it('passes when sell activity array is empty', () => {
    expect(evalBuyOnly([])).toBe(true);
  });

  it('fails when sell activity array has items', () => {
    expect(evalBuyOnly([{ type: 'SELL' }])).toBe(false);
  });
});

describe('evalPositionValue', () => {
  it('passes at exactly 500', () => {
    expect(evalPositionValue(500)).toBe(true);
  });

  it('passes at exactly 3000', () => {
    expect(evalPositionValue(3000)).toBe(true);
  });

  it('passes at 1500', () => {
    expect(evalPositionValue(1500)).toBe(true);
  });

  it('fails at 499', () => {
    expect(evalPositionValue(499)).toBe(false);
  });

  it('fails at 3001', () => {
    expect(evalPositionValue(3001)).toBe(false);
  });
});

describe('evalConviction', () => {
  it('passes at 0.61', () => {
    expect(evalConviction(0.61)).toBe(true);
  });

  it('fails at exactly 0.6', () => {
    expect(evalConviction(0.6)).toBe(false);
  });

  it('fails at 0.59', () => {
    expect(evalConviction(0.59)).toBe(false);
  });
});
