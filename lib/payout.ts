// Server-shared limits for the DevCoin cash-out flow. Kept in one place so the
// purchase, payout and admin endpoints agree, and so the values are unit
// testable without a database.

/** Longest payout method string accepted (matches devcoin_payouts.method). */
export const MAX_METHOD = 120;

/** Longest admin note accepted when resolving a payout. */
export const MAX_NOTE = 500;

/** Most recent payout requests an admin page will fetch in one call. */
export const MAX_PAYOUT_ROWS = 200;

/** A payout may not request more DevCoins than this. */
export const MAX_PAYOUT_DEVCOINS = 1_000_000;

/** Trims and truncates free text coming from a request body. */
export function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Coerces a body value to a positive integer, or null when it is not one. */
export function toPositiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}
