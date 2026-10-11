import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  buildGameplay,
  clampNumber,
  slugify,
  GOOD_LABEL,
  BAD_LABEL,
} from "@/lib/studioConfig";

describe("buildGameplay", () => {
  it("maps the editor config to the engine gameplay shape", () => {
    const gp = buildGameplay({
      ...DEFAULT_CONFIG,
      mode: "shooter",
      difficulty: "hard",
      levels: 7,
      goal: 30,
      speed: 5.5,
      spawnMs: 500,
    });
    expect(gp.mode).toBe("shooter");
    expect(gp.genre).toBe("Arcade Shooter");
    expect(gp.difficulty).toBe("hard");
    expect(gp.levels).toBe(7);
    expect(gp.goal).toBe(30);
    expect(gp.speed).toBe(5.5);
    expect(gp.spawnMs).toBe(500);
  });

  it("passes theme and names through unchanged", () => {
    const gp = buildGameplay(DEFAULT_CONFIG);
    expect(gp.theme).toEqual(DEFAULT_CONFIG.theme);
    expect(gp.names).toEqual(DEFAULT_CONFIG.names);
  });

  it("uses the right genre per mode", () => {
    expect(buildGameplay({ ...DEFAULT_CONFIG, mode: "catch" }).genre).toBe("Catch 'em up");
    expect(buildGameplay({ ...DEFAULT_CONFIG, mode: "runner" }).genre).toBe("Endless Runner");
  });

  it("carries the 2D/3D dimension through", () => {
    expect(buildGameplay(DEFAULT_CONFIG).dimension).toBe("2d");
    expect(buildGameplay({ ...DEFAULT_CONFIG, dimension: "3d" }).dimension).toBe("3d");
  });
});

describe("clampNumber", () => {
  it("clamps to the range", () => {
    expect(clampNumber("0", 1, 10, 5)).toBe(1);
    expect(clampNumber("99", 1, 10, 5)).toBe(10);
    expect(clampNumber("7", 1, 10, 5)).toBe(7);
  });

  it("falls back for non-numeric input", () => {
    expect(clampNumber("", 1, 10, 5)).toBe(5);
    expect(clampNumber("abc", 1, 10, 5)).toBe(5);
  });
});

describe("slugify", () => {
  it("lowercases, hyphenates and strips invalid characters", () => {
    expect(slugify("Neon Space Catcher!")).toBe("neon-space-catcher");
  });

  it("truncates to 30 characters", () => {
    expect(slugify("a".repeat(50)).length).toBe(30);
  });

  it("falls back to 'game' when nothing remains", () => {
    expect(slugify("!!!")).toBe("game");
  });
});

describe("labels", () => {
  it("has a good/bad label for every mode", () => {
    for (const mode of ["catch", "shooter", "runner"] as const) {
      expect(GOOD_LABEL[mode]).toBeTruthy();
      expect(BAD_LABEL[mode]).toBeTruthy();
    }
  });
});
