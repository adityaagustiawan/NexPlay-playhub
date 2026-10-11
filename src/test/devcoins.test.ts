// devcoins.test.ts
// The DevCoin economy rules: 50 DevCoins = $0.99, cash-out from 200 DevCoins,
// and a sale credits the creator one DevCoin per NexCoin spent.
import { describe, expect, it } from "vitest";
import {
  MIN_PAYOUT_DEVCOINS,
  canCashOut,
  centsToDevcoins,
  devcoinsEarned,
  devcoinsToCents,
  devcoinsToUsd,
  devcoinsUntilCashOut,
  formatDevcoins,
  formatUsd,
  isPayoutStatus,
  ledgerKindLabel,
  payoutStatusLabel,
  summariseEarnings,
  validateItemPrice,
  validatePayout,
} from "@/lib/devcoins";

describe("conversion rate", () => {
  it("pays 99 cents for every 50 DevCoins", () => {
    expect(devcoinsToCents(0)).toBe(0);
    expect(devcoinsToCents(50)).toBe(99);
    expect(devcoinsToCents(100)).toBe(198);
    expect(devcoinsToCents(200)).toBe(396);
    expect(devcoinsToCents(1000)).toBe(1980);
  });

  it("never promises a fraction of a cent", () => {
    // 1 DevCoin is 1.98c, so a single coin must not become 2 cents.
    expect(devcoinsToCents(1)).toBe(1);
    expect(devcoinsToCents(2)).toBe(3);
    expect(devcoinsToCents(24)).toBe(47);
  });

  it("treats junk input as nothing", () => {
    expect(devcoinsToCents(-10)).toBe(0);
    expect(devcoinsToCents(Number.NaN)).toBe(0);
  });

  it("converts cents back to DevCoins", () => {
    expect(centsToDevcoins(99)).toBe(50);
    expect(centsToDevcoins(198)).toBe(100);
    expect(centsToDevcoins(0)).toBe(0);
  });
});

describe("minimum cash-out", () => {
  it("allows exactly 200 DevCoins and nothing below it", () => {
    expect(canCashOut(199)).toBe(false);
    expect(canCashOut(200)).toBe(true);
    expect(canCashOut(201)).toBe(true);
    expect(canCashOut(0)).toBe(false);
  });

  it("reports how much is still missing", () => {
    expect(devcoinsUntilCashOut(0)).toBe(MIN_PAYOUT_DEVCOINS);
    expect(devcoinsUntilCashOut(199)).toBe(1);
    expect(devcoinsUntilCashOut(200)).toBe(0);
    expect(devcoinsUntilCashOut(5000)).toBe(0);
  });
});

describe("formatting", () => {
  it("shows cents as dollars", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(5)).toBe("$0.05");
    expect(formatUsd(396)).toBe("$3.96");
    expect(formatUsd(100)).toBe("$1.00");
  });

  it("groups DevCoins", () => {
    expect(formatDevcoins(0)).toBe("0");
    expect(formatDevcoins(250)).toBe("250");
    expect(formatDevcoins(1200)).toBe("1,200");
  });

  it("prices a DevCoin balance in dollars", () => {
    expect(devcoinsToUsd(200)).toBe("$3.96");
    expect(devcoinsToUsd(50)).toBe("$0.99");
    expect(devcoinsToUsd(0)).toBe("$0.00");
  });
});

describe("sales", () => {
  it("credits one DevCoin per NexCoin spent", () => {
    expect(devcoinsEarned(250)).toBe(250);
    expect(devcoinsEarned(1)).toBe(1);
    expect(devcoinsEarned(-5)).toBe(0);
  });
});

describe("validateItemPrice", () => {
  it("accepts whole-number NexCoin prices", () => {
    expect(validateItemPrice("250")).toEqual({ error: null, value: 250 });
    expect(validateItemPrice(0)).toEqual({ error: null, value: 0 });
    expect(validateItemPrice(" 40 ")).toEqual({ error: null, value: 40 });
  });

  it("rejects junk and negatives", () => {
    expect(validateItemPrice("abc").error).toBeTruthy();
    expect(validateItemPrice("").error).toBeTruthy();
    expect(validateItemPrice("-1").error).toBe("Price cannot be negative.");
  });

  it("rejects prices above the ceiling", () => {
    const result = validateItemPrice("100001");
    expect(result.error).toContain("cannot exceed");
    expect(result.value).toBe(0);
  });
});

describe("validatePayout", () => {
  it("requires the 200-DevCoin floor", () => {
    const result = validatePayout(500, "199");
    expect(result.error).toContain("200");
    expect(result.value).toBe(0);
  });

  it("rejects asking for more than the balance", () => {
    const result = validatePayout(300, "400");
    expect(result.error).toContain("more DevCoins");
  });

  it("rejects empty or zero requests", () => {
    expect(validatePayout(500, "0").error).toBeTruthy();
    expect(validatePayout(500, "abc").error).toBeTruthy();
    expect(validatePayout(500, "  ").error).toBeTruthy();
  });

  it("accepts a valid amount inside the balance", () => {
    expect(validatePayout(500, "250")).toEqual({ error: null, value: 250 });
    expect(validatePayout(500, 500)).toEqual({ error: null, value: 500 });
  });

  it("uses the whole balance comfortably", () => {
    // A creator with 500 DevCoins may withdraw all of it (~$9.90).
    expect(devcoinsToCents(validatePayout(500, "500").value)).toBe(990);
  });
});

describe("summariseEarnings", () => {
  const sales = [
    { game_id: "a", devcoins_credited: 250 },
    { game_id: "a", devcoins_credited: 50 },
    { game_id: "b", devcoins_credited: 100 },
  ];

  it("totals DevCoins and sales", () => {
    const result = summariseEarnings(sales, { a: "Alpha", b: "Beta" });
    expect(result.totalEarned).toBe(400);
    expect(result.sales).toBe(3);
  });

  it("breaks earnings down per game, highest first", () => {
    const result = summariseEarnings(sales, { a: "Alpha", b: "Beta" });
    expect(result.perGame).toEqual([
      { gameId: "a", title: "Alpha", devcoins: 300, sales: 2 },
      { gameId: "b", title: "Beta", devcoins: 100, sales: 1 },
    ]);
  });

  it("is empty when nothing has sold", () => {
    expect(summariseEarnings([], {})).toEqual({ totalEarned: 0, sales: 0, perGame: [] });
  });

  it("labels sales whose game was deleted", () => {
    const result = summariseEarnings(sales, { a: "Alpha" });
    expect(result.perGame[1].title).toBe("Deleted game");
  });
});

describe("status labels", () => {
  it("labels payout states", () => {
    expect(payoutStatusLabel("pending")).toBe("Pending");
    expect(payoutStatusLabel("paid")).toBe("Paid");
    expect(payoutStatusLabel("rejected")).toBe("Rejected");
    expect(payoutStatusLabel(null)).toBe("Unknown");
  });

  it("recognises known payout states only", () => {
    expect(isPayoutStatus("pending")).toBe(true);
    expect(isPayoutStatus("paid")).toBe(true);
    expect(isPayoutStatus("rejected")).toBe(true);
    expect(isPayoutStatus("nope")).toBe(false);
    expect(isPayoutStatus(5)).toBe(false);
  });

  it("labels ledger entries", () => {
    expect(ledgerKindLabel("sale")).toBe("Item sale");
    expect(ledgerKindLabel("payout")).toBe("Cash-out request");
    expect(ledgerKindLabel("payout_refund")).toBe("Cash-out refunded");
    expect(ledgerKindLabel("adjustment")).toBe("Adjustment");
  });
});
