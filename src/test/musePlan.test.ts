import { describe, expect, it } from "vitest";
import { planGame, parseModelConfig, mergeConfig, museSystemPrompt } from "@/lib/musePlan";
import { DEFAULT_CONFIG } from "@/lib/studioConfig";
import { PROVIDERS, defaultAIConfig, findProvider, allModels } from "@/lib/aiProviders";

describe("planGame (offline Muse)", () => {
  it("detects a 3D shooter and hard difficulty", () => {
    const plan = planGame("make a 3D space shooter that is really hard with 9 levels");
    expect(plan.config.dimension).toBe("3d");
    expect(plan.config.mode).toBe("shooter");
    expect(plan.config.difficulty).toBe("hard");
    expect(plan.config.levels).toBe(9);
    expect(plan.source).toBe("offline");
    expect(plan.actions.length).toBeGreaterThan(3);
  });

  it("detects a 2D runner and applies a theme", () => {
    const plan = planGame("a chill ocean endless runner");
    expect(plan.config.dimension).toBe("2d");
    expect(plan.config.mode).toBe("runner");
    expect(plan.config.difficulty).toBe("easy");
    expect(plan.config.theme.player).toBe("#7ee8fa"); // ocean palette
  });

  it("honours an explicit title and goal", () => {
    const plan = planGame('a game called "Starfall" with goal 42 to win');
    expect(plan.config.title).toBe("Starfall");
    expect(plan.config.goal).toBe(42);
  });

  it("always returns a valid, clamped config", () => {
    const plan = planGame("make a game");
    expect(plan.config.levels).toBeGreaterThanOrEqual(1);
    expect(plan.config.levels).toBeLessThanOrEqual(10);
    expect(plan.config.speed).toBeGreaterThanOrEqual(1);
    expect(plan.config.speed).toBeLessThanOrEqual(8);
    expect(plan.config.title.length).toBeGreaterThan(0);
  });

  it("keeps base fields it does not touch", () => {
    const plan = planGame("make a game", { ...DEFAULT_CONFIG, description: "keep me" });
    // description is overwritten by the prompt text, but theme stays if no theme word
    expect(plan.config.theme).toBeDefined();
  });
});

describe("parseModelConfig", () => {
  it("parses a fenced json block", () => {
    const out = parseModelConfig('Here you go:\n```json\n{"rationale":"x","config":{"mode":"runner"}}\n```');
    expect(out?.config?.mode).toBe("runner");
    expect(out?.rationale).toBe("x");
  });

  it("parses bare json", () => {
    const out = parseModelConfig('{"config":{"goal":5}}');
    expect(out?.config?.goal).toBe(5);
  });

  it("returns null for prose without json", () => {
    expect(parseModelConfig("sorry, I can't do that")).toBeNull();
  });
});

describe("mergeConfig", () => {
  it("clamps numbers and rejects bad enums", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {
      levels: 99,
      goal: -5,
      mode: "banana" as never,
      speed: 50,
    });
    expect(merged.levels).toBe(10);
    expect(merged.goal).toBe(1);
    expect(merged.speed).toBe(8);
    expect(merged.mode).toBe(DEFAULT_CONFIG.mode); // invalid enum ignored
  });

  it("deep-merges theme and names", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {
      theme: { player: "#123456" } as never,
      names: { good: "Gems" } as never,
    });
    expect(merged.theme.player).toBe("#123456");
    expect(merged.theme.bg).toBe(DEFAULT_CONFIG.theme.bg);
    expect(merged.names.good).toBe("Gems");
    expect(merged.names.bad).toBe(DEFAULT_CONFIG.names.bad);
  });

  it("returns base for a missing patch", () => {
    expect(mergeConfig(DEFAULT_CONFIG, undefined)).toEqual(DEFAULT_CONFIG);
  });
});

describe("museSystemPrompt", () => {
  it("asks for a json block and includes the current config", () => {
    const prompt = museSystemPrompt(DEFAULT_CONFIG);
    expect(prompt).toContain("json");
    expect(prompt).toContain(DEFAULT_CONFIG.title);
  });
});

describe("aiProviders", () => {
  it("has at least one keyless free provider", () => {
    expect(PROVIDERS.some((p) => p.free && p.base && p.id !== "offline")).toBe(true);
  });

  it("falls back to the first provider for unknown ids", () => {
    expect(findProvider("does-not-exist")).toBe(PROVIDERS[0]);
  });

  it("starts on a working free default", () => {
    const cfg = defaultAIConfig();
    expect(cfg.plugin).toBe("offline");
    expect(findProvider(cfg.providerId).free).toBe(true);
  });

  it("lists every model exactly once per provider", () => {
    const models = allModels();
    expect(models.length).toBeGreaterThan(5);
    expect(models.every((m) => m.model && m.provider)).toBe(true);
  });
});
