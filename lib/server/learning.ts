// learning.ts — the NexCode "learn from every game" loop (server-only).
//
// Every generation is stored in public.nexcode_learning. Players rate results
// from worst (1) to best (5). Before a new generation we fetch the top-rated
// examples with a similar prompt and hand them to the LLM as references, so the
// engine's output drifts toward what players actually liked.
//
// Pure ranking/formatting logic lives in learningCore.ts (unit-tested).
// Without an LLM key this data is still captured (ready to learn the moment a
// key is configured); the deterministic generator is unaffected.
import { getAdminClient } from "./admin.js";
import type { GeneratedGame } from "./generator.js";
import {
  type LearningExample,
  selectRelevantExamples,
  toFewShot,
} from "./learningCore.js";

export { keywords, scoreExample, selectRelevantExamples, toFewShot } from "./learningCore.js";
export type { LearningExample } from "./learningCore.js";

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
        theme: (input.game.assets as Record<string, unknown> | undefined)?.palette ?? null,
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
