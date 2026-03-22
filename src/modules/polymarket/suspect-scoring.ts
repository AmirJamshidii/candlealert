const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export function evalNewWallet(
  createdAt: string | null,
  closeTime: number,
): boolean | null {
  if (!createdAt) return null;
  const age = closeTime - new Date(createdAt).getTime();
  return age <= FIVE_DAYS_MS;
}

export function evalBuyOnly(sellActivity: unknown[]): boolean {
  return sellActivity.length === 0;
}

export function evalPositionValue(currentValue: number): boolean {
  return currentValue >= 500 && currentValue <= 3000;
}

export function evalConviction(avgPrice: number): boolean {
  return avgPrice > 0.6;
}

export function computeSuspectScore(
  criterionNewWallet: boolean | null,
  criterionBuyOnly: boolean | null,
  criterionPositionValue: boolean | null,
  criterionConviction: boolean | null,
): number {
  return (
    (criterionNewWallet ? 35 : 0) +
    (criterionBuyOnly ? 35 : 0) +
    (criterionPositionValue ? 15 : 0) +
    (criterionConviction ? 15 : 0)
  );
}
