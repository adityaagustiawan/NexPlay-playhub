import { describe, it, expect } from "vitest";
import { formatPlayTime, mergeProgress, timeAgo } from "@/lib/progress";

describe("formatPlayTime", () => {
  it("formats seconds under a minute", () => {
    expect(formatPlayTime(0)).toBe("0s");
    expect(formatPlayTime(45)).toBe("45s");
  });

  it("formats minutes under an hour", () => {
    expect(formatPlayTime(60)).toBe("1m");
    expect(formatPlayTime(3599)).toBe("59m");
  });

  it("formats hours with zero-padded minutes", () => {
    expect(formatPlayTime(3600)).toBe("1h 00m");
    expect(formatPlayTime(3900)).toBe("1h 05m");
    expect(formatPlayTime(90000)).toBe("25h 00m");
  });

  it("clamps negatives and floors fractions", () => {
    expect(formatPlayTime(-10)).toBe("0s");
    expect(formatPlayTime(59.9)).toBe("59s");
  });
});

describe("mergeProgress", () => {
  it("lets the patch win and keeps untouched keys", () => {
    const merged = mergeProgress({ level: 3, coins: 10 }, { level: 4 });
    expect(merged).toEqual({ level: 4, coins: 10 });
  });

  it("ignores undefined values so a partial save never wipes state", () => {
    const merged = mergeProgress({ coins: 10, health: 100 }, { coins: undefined, health: 80 });
    expect(merged).toEqual({ coins: 10, health: 80 });
  });

  it("supports deep-ish nested values as opaque blobs", () => {
    const merged = mergeProgress({ inventory: { sword: true } }, { checkpoint: "level-2" });
    expect(merged).toEqual({ inventory: { sword: true }, checkpoint: "level-2" });
  });
});

describe("timeAgo", () => {
  const now = Date.now();

  it("collapses very recent saves to 'just now'", () => {
    expect(timeAgo(new Date(now).toISOString())).toBe("just now");
  });

  it("reports minutes, hours and days", () => {
    expect(timeAgo(new Date(now - 5 * 60000).toISOString())).toBe("5m ago");
    expect(timeAgo(new Date(now - 3 * 3600000).toISOString())).toBe("3h ago");
    expect(timeAgo(new Date(now - 2 * 86400000).toISOString())).toBe("2d ago");
  });

  it("handles invalid input gracefully", () => {
    expect(timeAgo("not-a-date")).toBe("");
  });
});
