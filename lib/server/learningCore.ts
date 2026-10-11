// learningCore.ts — pure, dependency-free helpers for the NexCode learning
// loop. Kept separate from learning.ts (which talks to Supabase) so the ranking
// logic can be unit-tested without any server/database imports.

export interface LearningExample {
  id: string;
  prompt: string;
  mode: string | null;
  theme: string | null;
  difficulty: string | null;
  rating: number | null;
  config: unknown;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "with", "for", "from", "into", "onto",
  "your", "you", "game", "make", "build", "create", "about", "where", "that",
  "this", "have", "has", "are", "was", "were", "will", "can", "let", "lets",
  "want", "need", "player", "players", "play", "playing", "like", "just",
  "some", "any", "all", "very", "more", "most", "made", "using", "use",
]);

/** Lowercase, strip punctuation, drop stopwords/short tokens, de-duplicate. */
export function keywords(text: string): string[] {
  const seen = new Set<string>();
  for (const w of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (w.length >= 3 && !STOPWORDS.has(w)) seen.add(w);
  }
  return Array.from(seen);
}

/** How relevant an already-rated example is to a new prompt (pure). */
export function scoreExample(ex: LearningExample, prompt: string, mode: string | null): number {
  const q = new Set(keywords(prompt));
  let overlap = 0;
  for (const w of keywords(ex.prompt)) if (q.has(w)) overlap++;
  const ratingBoost = (ex.rating ?? 3) * 2; // better-rated games weigh more
  const modeBoost = mode && ex.mode === mode ? 3 : 0;
  return overlap * 4 + modeBoost + ratingBoost;
}

/**
 * From a pool of examples, keep only well-rated ones (>= 4) and return the most
 * relevant to `prompt`. Deterministic (ties broken by id) so it can be tested.
 */
export function selectRelevantExamples(
  examples: LearningExample[],
  prompt: string,
  mode: string | null,
  limit = 4,
): LearningExample[] {
  return examples
    .filter((e) => (e.rating ?? 0) >= 4)
    .map((e) => ({ e, s: scoreExample(e, prompt, mode) }))
    .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id))
    .slice(0, Math.max(0, limit))
    .map((x) => x.e);
}

/** Render examples as a compact reference block for the LLM prompt (pure). */
export function toFewShot(examples: LearningExample[]): string {
  if (!examples.length) return "";
  return examples
    .map((e, i) => {
      const g = (e.config ?? {}) as Record<string, any>;
      const gp = (g.gameplay ?? {}) as Record<string, any>;
      const bits = [
        `prompt="${e.prompt.slice(0, 120)}"`,
        `title="${String(g.title ?? "").slice(0, 60)}"`,
        `mode=${gp.mode ?? e.mode ?? "?"}`,
        `genre="${String(gp.genre ?? "").slice(0, 40)}"`,
        `difficulty=${gp.difficulty ?? e.difficulty ?? "?"}`,
        `speed=${gp.speed ?? "?"}`,
        `spawnMs=${gp.spawnMs ?? "?"}`,
        `theme=${e.theme ?? g.assets?.palette ?? ""}`,
      ];
      return `${i + 1}. ${bits.join(", ")}`;
    })
    .join("\n");
}
