const LABOR_RATE_MULTIPLIERS: Record<string, number> = {
  low: 0.8,    // Rural / low cost of living markets
  medium: 1.0, // Average US market
  high: 1.3,   // Major metros (NYC, SF, LA, etc.)
};

export function getLaborRateMultiplier(tier: string): number {
  return LABOR_RATE_MULTIPLIERS[tier] || 1.0;
}
