import { describe, it, expect } from "vitest";
import { generateLocal } from "../../lib/server/generator";

const PROMPTS = [
  "a neon racer where you collect energy cores",
  "a space shooter with alien bosses",
  "a platformer where a frog catches flies",
  "endless runner dodging obstacles",
  "a game about catching falling stars",
];

describe("generateLocal", () => {
  it.each(PROMPTS)("produces a well-formed package for: %s", (prompt) => {
    const g = generateLocal(prompt);

    expect(typeof g.title).toBe("string");
    expect(g.title.length).toBeGreaterThan(0);
    expect(typeof g.description).toBe("string");

    expect(["catch", "shooter", "runner"]).toContain(g.gameplay.mode);
    expect(g.gameplay.levels).toBeGreaterThan(0);
    expect(g.gameplay.goal).toBeGreaterThan(0);
    expect(g.gameplay.speed).toBeGreaterThan(0);
    expect(g.assets).toBeTypeOf("object");
  });

  it("is deterministic — same prompt, same result", () => {
    const prompt = "a space shooter with alien bosses";
    expect(generateLocal(prompt)).toEqual(generateLocal(prompt));
  });

  it("detects obvious modes from the prompt", () => {
    expect(generateLocal("an endless runner dodging obstacles").gameplay.mode).toBe("runner");
    expect(generateLocal("a space shooter with enemies").gameplay.mode).toBe("shooter");
  });
});
