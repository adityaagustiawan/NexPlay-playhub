import { describe, it, expect } from "vitest";
import { COIN_PACKAGES, findPackage } from "../../lib/server/packages";

describe("coin packages", () => {
  it("has unique ids and positive prices", () => {
    const ids = COIN_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of COIN_PACKAGES) {
      expect(p.coins).toBeGreaterThan(0);
      expect(p.priceCents).toBeGreaterThan(0);
      expect(p.bonus).toBeGreaterThanOrEqual(0);
    }
  });

  it("finds a package by id", () => {
    const pkg = findPackage("3");
    expect(pkg).toBeDefined();
    expect(pkg?.coins).toBe(1000);
    expect(pkg?.popular).toBe(true);
  });

  it("returns undefined for unknown ids", () => {
    expect(findPackage("does-not-exist")).toBeUndefined();
  });
});
