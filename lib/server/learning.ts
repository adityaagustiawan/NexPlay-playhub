// learning.ts — the NexCode "learn from every game" loop (server-only).
//
// Every generation is stored in public.nexcode_learning. Players rate results
// from worst (1) to best (5). Before a new generation we fetch the top-rated
// examples with a similar prompt and hand them to the LLM as references, so the
// engine's output drifts toward what players actually liked.
//
// Without an LLM key this data is still captured (so it is ready to learn the
// moment a key is configured); the deterministic generator is unaffected.
import { getAdminClient } from "./admin.js";
import type { GeneratedGame } from "./generator.js";

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
  "some", "any", "all", "very", "more", "most", "make", "made", "using", "use",
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
 * relevant to `prompt`. Pure and deterministic so it can be unit-tested.
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

/** Fetch the best-rated similar examples for a new prompt. Never throws. */
export async function getTopExamples(
  prompt: string,
  mode: string | null,
  limit = 4,
): Promise<LearningExample[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("nexcode_learning")
      .select("id,prompt,mode,theme,difficulty,rating,config")
      .gte("rating", 4)
      .order("rating", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60);
    if (error || !data) return [];
    return selectRelevantExamples(data as LearningExample[], prompt, mode, limit);
  } catch {
    return [];
  }
}

/** Persist a generation so it can be rated and learned from. Never throws. */
export async function recordGeneration(input: {
  userId: string;
  prompt: string;
  game: GeneratedGame;
  gameId?: string | null;
}): Promise<string | null> {
  try {
    const admin = getAdminClient();
    const gp = input.game.gameplay;
    const { data, error } = await admin
      .from("nexcode_learning")
      .insert({
        user_id: input.userId,
        prompt: input.prompt.slice(0, 1000),
        config: input.game as unknown as Record<string, unknown>,
        mode: gp.mode,
        theme: input.game.assets?.palette ?? null,
        difficulty: gp.difficulty,
        game_id: input.gameId ?? null,
      })
      .select("id")
      .single();
    if (error) return null;
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}
