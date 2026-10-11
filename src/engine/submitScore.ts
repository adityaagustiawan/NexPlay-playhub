// submitScore.ts — Submit a player's score to the scores table.
// Anti-duplicate: only submits once per game-over session.

import { supabase } from "@/integrations/supabase/client";
import { eventBus, EngineEvents } from "./eventBus";

let submitted = false;

/**
 * Submit a score for a game. Only works once per page lifecycle.
 * Resets on page reload (anti-duplicate guard).
 */
export async function submitScore(
  gameId: string,
  playerId: string,
  score: number
): Promise<boolean> {
  if (submitted) {
    console.log("[submitScore] Score already submitted this session — skipping");
    return false;
  }

  const { error } = await supabase.from("scores").insert({
    game_id: gameId,
    player_id: playerId,
    score,
  });

  if (error) {
    console.error("[submitScore] Failed:", error.message);
    return false;
  }

  submitted = true;
  console.log(`[submitScore] Submitted score ${score} for game ${gameId}`);
  return true;
}

/** Reset the anti-duplicate guard (call on new game session). */
export function resetSubmitScore(): void {
  submitted = false;
}

// Auto-emit gameOver event when score is submitted
eventBus.on(EngineEvents.GameOver, (data) => {
  const { gameId, playerId, score } = data as {
    gameId: string;
    playerId: string;
    score: number;
  };
  submitScore(gameId, playerId, score);
});
