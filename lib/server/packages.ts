// Server-side source of truth for NexCoin packages.
// Kept in sync with src/data/gameData.ts (topUpPackages).
export interface CoinPackage {
  id: string;
  coins: number;
  bonus: number;
  /** price in USD cents — never send currency from the client */
  priceCents: number;
  popular?: boolean;
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: "1", coins: 100, bonus: 0, priceCents: 99 },
  { id: "2", coins: 500, bonus: 50, priceCents: 499 },
  { id: "3", coins: 1000, bonus: 150, priceCents: 999, popular: true },
  { id: "4", coins: 2500, bonus: 500, priceCents: 1999 },
  { id: "5", coins: 5000, bonus: 1500, priceCents: 3999 },
  { id: "6", coins: 10000, bonus: 4000, priceCents: 7499 },
];

export function findPackage(id: string): CoinPackage | undefined {
  return COIN_PACKAGES.find((p) => p.id === id);
}