import { describe, it, expect } from "vitest";
import { generateLocal } from "../../lib/server/generator";
import { verifyGame } from "../../lib/server/verify";

describe("verifyGame (NexCode self-check)", () => {
  it("reports generated games as playable", () => {
    for (const prompt of [
      "a neon racer where you collect energy cores",
      "a space shooter with alien bosses",
      "endless runner dodging obstacles",
    ]) {
      const result = verifyGame(generateLocal(prompt));
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
    }
  });

  it("fails an obviously broken config", () => {
    const broken = generateLocal("a space shooter");
    // Corrupt the level/goal so the config check must fail.
    broken.gameplay.levels = 0;
    const result = verifyGame(broken);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
