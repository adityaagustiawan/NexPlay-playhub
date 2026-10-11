// devcoins.ts
// Rules for the DevCoin economy.
//
// Players buy a creator's in-game items with NexCoins. Every NexCoin spent is
// credited to the creator as one DevCoin (a 1:1 conversion with no platform
// fee). DevCoins are *not* spendable — they only exist to be cashed out:
//
//   50 DevCoins = $0.99   (1 DevCoin = 1.98 cents)
//   minimum cash-out: 200 DevCoins (~$3.96)
//
// All money movement happens in Postgres (see the devcoins_economy
// migration), so these helpers only do the maths and validation the client
// needs to show rates and gate the cash-out button.

/** DevCoins worth one whole dollar. */
export const DEVCOINS_PER_USD = 50

/** Cents paid for DEVCOINS_PER_USD DevCoins. */
export const CENTS_PER_DEVCOIN_BATCH = 99

/** The conversion rate, in cents per DevCoin. */
export const CENTS_PER_DEVCOIN = CENTS_PER_DEVCOIN_BATCH / DEVCOINS_PER_USD

/** Smallest DevCoin balance that may be cashed out. */
export const MIN_PAYOUT_DEVCOINS = 200

/**
 * Convert DevCoins to cents using integer maths so a payout never promises a
 * fraction of a cent. 50 DevCoins -> 99 cents, 200 -> 396, 1000 -> 1980.
 */
export function devcoinsToCents(devcoins: number): number {
  if (!Number.isFinite(devcoins) || devcoins <= 0) return 0
  return Math.floor(devcoins * CENTS_PER_DEVCOIN_BATCH / DEVCOINS_PER_USD)
}

/** DevCoins a payment of `cents` is worth. */
export function centsToDevcoins(cents: number): number {
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return Math.floor((cents * DEVCOINS_PER_USD) / CENTS_PER_DEVCOIN_BATCH)
}

/** Format cents as a US dollar string, e.g. 396 -> "$3.96". */
export function formatUsd(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0
  return `$${(safe / 100).toFixed(2)}`
}

/** The cash-out value of a DevCoin balance, as a dollar string. */
export function devcoinsToUsd(devcoins: number): string {
  return formatUsd(devcoinsToCents(devcoins))
}

/** Group-separated DevCoin count, e.g. 1200 -> "1,200". */
export function formatDevcoins(devcoins: number): string {
  const safe = Number.isFinite(devcoins) ? Math.trunc(devcoins) : 0
  return safe.toLocaleString("en-US")
}

/** True when the balance is at or above the cash-out floor. */
export function canCashOut(devcoins: number): boolean {
  return Number.isFinite(devcoins) && devcoins >= MIN_PAYOUT_DEVCOINS
}

/** DevCoins still needed before a cash-out is allowed. */
export function devcoinsUntilCashOut(devcoins: number): number {
  if (canCashOut(devcoins)) return 0
  return Math.max(0, MIN_PAYOUT_DEVCOINS - Math.trunc(devcoins))
}

/** DevCoins a creator earns from a sale (1 NexCoin spent = 1 DevCoin). */
export function devcoinsEarned(priceCoins: number): number {
  return Number.isFinite(priceCoins) && priceCoins > 0 ? Math.trunc(priceCoins) : 0
}

export const PAYOUT_METHODS = ["PayPal", "Bank transfer", "Wise", "Gift card"] as const

export type PayoutMethod = (typeof PAYOUT_METHODS)[number]

export const PAYOUT_STATUSES = ["pending", "paid", "rejected"] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

export function isPayoutStatus(value: unknown): value is PayoutStatus {
  return typeof value === "string" && (PAYOUT_STATUSES as readonly string[]).includes(value)
}

export function payoutStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "paid":
      return "Paid"
    case "rejected":
      return "Rejected"
    case "pending":
      return "Pending"
    default:
      return status ? status : "Unknown"
  }
}

/** Human-readable sentence for the DevCoin ledger entry kinds. */
export function ledgerKindLabel(kind: string): string {
  switch (kind) {
    case "sale":
      return "Item sale"
    case "payout":
      return "Cash-out request"
    case "payout_refund":
      return "Cash-out refunded"
    case "adjustment":
      return "Adjustment"
    default:
      return kind
  }
}

/** Ceiling on a single item's price. */
export const MAX_ITEM_PRICE = 100000

export interface PriceCheck {
  /** Human-readable reason, or null when the price is valid. */
  error: string | null;
  /** Parsed price in NexCoins (0 when invalid). */
  value: number;
}

/** Validate a store item price entered as a whole number of NexCoins. */
export function validateItemPrice(raw: string | number): PriceCheck {
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(value)) return { error: "Enter a price in NexCoins.", value: 0 }
  if (value < 0) return { error: "Price cannot be negative.", value: 0 }
  if (value > MAX_ITEM_PRICE) {
    return {
      error: `Price cannot exceed ${MAX_ITEM_PRICE.toLocaleString("en-US")} NexCoins.`,
      value: 0,
    }
  }
  return { error: null, value }
}

export interface PayoutCheck {
  /** Human-readable reason, or null when the request is valid. */
  error: string | null;
  /** DevCoins to withdraw (0 when invalid). */
  value: number;
}

/** Validate a cash-out request against the balance and the 200-DevCoin floor. */
export function validatePayout(balance: number, raw: string | number): PayoutCheck {
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "Enter how many DevCoins to withdraw.", value: 0 }
  }
  if (value < MIN_PAYOUT_DEVCOINS) {
    return {
      error: `You can only cash out from ${MIN_PAYOUT_DEVCOINS.toLocaleString("en-US")} DevCoins.`,
      value: 0,
    }
  }
  if (value > balance) {
    return { error: "That is more DevCoins than you have.", value: 0 }
  }
  return { error: null, value }
}

/** Total NexCoins a player has already spent (used for savings copy). */
export function totalSpent(prices: number[]): number {
  return prices.reduce((sum, p) => sum + (Number.isFinite(p) && p > 0 ? Math.trunc(p) : 0), 0)
}
