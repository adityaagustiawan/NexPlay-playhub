import { describe, expect, it } from "vitest";
import {
  keywords,
  scoreExample,
  selectRelevantExamples,
  toFewShot,
  type LearningExample,
} from "../../lib/server/learningCore";

function ex(partial: Partial<LearningExample>): LearningExample {
  return {
    id: "id",
    prompt: "a game",
    mode: null,
    theme: null,
    difficulty: null,
    rating: null,
    config: {},
    ...partial,
  };
}

describe("keywords", () => {
  it("drops stopwords, short tokens and punctuation and de-duplicates", () => {
    expect(keywords("A neon space game where you collect the stars, neon!")).toEqual([
      "neon",
      "space",
      "collect",
      "stars",
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(keywords("")).toEqual([]);
    expect(keywords("   the a of")).toEqual([]);
  });
});

describe("scoreExample", () => {
  it("rewards keyword overlap, mode match and higher ratings", () => {
    const prompt = "neon space catcher";
    const highOverlap = ex({ id: "a", prompt: "neon space catcher", mode: "catch", rating: 5 });
    const lowOverlap = ex({ id: "b", prompt: "forest runner", mode: "runner", rating: 3 });
    expect(scoreExample(highOverlap, prompt, "catch")).toBeGreaterThan(
      scoreExample(lowOverlap, prompt, "catch"),
    );
  });

  it("gives a bonus when the example mode matches the target mode", () => {
    const prompt = "collect gems";
    const same = ex({ id: "a", prompt: "collect gems", mode: "catch", rating: 4 });
    const other = ex({ id: "b", prompt: "collect gems", mode: "runner", rating: 4 });
    expect(scoreExample(same, prompt, "catch")).toBeGreaterThan(scoreExample(other, prompt, "catch"));
  });
});

describe("selectRelevantExamples", () => {
  const pool: LearningExample[] = [
    ex({ id: "bad", prompt: "neon space", rating: 2 }),
    ex({ id: "unrated", prompt: "neon space" }),
    ex({ id: "good-1", prompt: "neon space catcher", mode: "catch", rating: 5 }),
    ex({ id: "good-2", prompt: "neon racer", mode: "runner", rating: 4 }),
    ex({ id: "good-3", prompt: "forest puzzle", mode: "catch", rating: 4 }),
  ];

  it("only learns from highly rated games (rating >= 4)", () => {
    const picked = selectRelevantExamples(pool, "neon space catcher", "catch", 10);
    expect(picked.map((e) => e.id)).not.toContain("bad");
    expect(picked.map((e) => e.id)).not.toContain("unrated");
  });

  it("ranks the most relevant example first", () => {
    const picked = selectRelevantExamples(pool, "neon space catcher", "catch", 3);
    expect(picked[0].id).toBe("good-1");
  });

  it("respects the limit", () => {
    expect(selectRelevantExamples(pool, "neon space", "catch", 2)).toHaveLength(2);
    expect(selectRelevantExamples(pool, "neon space", "catch", 0)).toHaveLength(0);
  });

  it("is deterministic for equal scores (ties broken by id)", () => {
    const a = ex({ id: "aaa", prompt: "same words", rating: 4 });
    const b = ex({ id: "bbb", prompt: "same words", rating: 4 });
    const forward = selectRelevantExamples([a, b], "same words", null, 2).map((e) => e.id);
    const reverse = selectRelevantExamples([b, a], "same words", null, 2).map((e) => e.id);
    expect(forward).toEqual(["aaa", "bbb"]);
    expect(reverse).toEqual(forward);
  });
});

describe("toFewShot", () => {
  it("returns an empty string when there are no examples", () => {
    expect(toFewShot([])).toBe("");
  });

  it("renders one numbered reference line per example", () => {
    const out = toFewShot([
      ex({
        id: "a",
        prompt: "neon space catcher",
        mode: "catch",
        theme: "cyber",
        rating: 5,
        config: {
          title: "Neon City Catcher",
          gameplay: { mode: "catch", genre: "Catch 'em up", difficulty: "hard", speed: 4.6, spawnMs: 620 },
        },
      }),
    ]);
    expect(out).toContain("1.");
    expect(out).toContain('title="Neon City Catcher"');
    expect(out).toContain("mode=catch");
    expect(out).toContain("theme=cyber");
    expect(out).toContain("speed=4.6");
  });
});
