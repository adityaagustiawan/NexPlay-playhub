// Durable per-player game progress.
//
// Progress is stored in `public.game_progress` keyed by (user_id, game_id) and
// protected by row-level security, so it is tied to the account and survives
// sign-out, hard refreshes, and clearing local storage. Anyone can log back in
// (password, Google, …) and keep playing where they left off.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface GameProgress {
  gameId: string;
  gameTitle: string | null;
  gameImage: string | null;
  progress: Record<string, unknown>;
  score: number;
  level: number;
  playSeconds: number;
  completed: boolean;
  lastPlayedAt: string;
}

export interface GameProgressPatch {
  gameTitle?: string | null;
  gameImage?: string | null;
  /** Arbitrary game-defined save state; merged with whatever is already saved. */
  progress?: Record<string, unknown>;
  score?: number;
  level?: number;
  /** Absolute total play time in seconds. */
  playSeconds?: number;
  /** Adds to the stored total play time (e.g. seconds from one session). */
  addPlaySeconds?: number;
  completed?: boolean;
  /** When false, leaves last_played_at untouched (used for background saves). */
  playedNow?: boolean;
}

type Row = {
  game_id: string;
  game_title: string | null;
  game_image: string | null;
  progress: Json | null;
  score: number;
  level: number;
  play_seconds: number;
  completed: boolean;
  last_played_at: string;
};

function mapRow(row: Row): GameProgress {
  return {
    gameId: row.game_id,
    gameTitle: row.game_title,
    gameImage: row.game_image,
    progress: (row.progress as Record<string, unknown> | null) ?? {},
    score: row.score ?? 0,
    level: row.level ?? 1,
    playSeconds: row.play_seconds ?? 0,
    completed: Boolean(row.completed),
    lastPlayedAt: row.last_played_at,
  };
}

/** Shallow-merge a save-state patch on top of an existing save (patch wins). */
export function mergeProgress(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

/** "45s", "12m", "1h 05m" style play time. */
export function formatPlayTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${String(rem).padStart(2, "0")}m`;
}

/** "just now", "5m ago", "3d ago", or a date for older saves. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** The signed-in player's saved progress for one game, or null if none yet. */
export async function loadProgress(
  userId: string,
  gameId: string,
): Promise<GameProgress | null> {
  const { data, error } = await supabase
    .from("game_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as unknown as Row) : null;
}

/** The player's most recently played games, newest first. */
export async function listRecentProgress(
  userId: string,
  limit = 6,
): Promise<GameProgress[]> {
  const { data, error } = await supabase
    .from("game_progress")
    .select("*")
    .eq("user_id", userId)
    .order("last_played_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as unknown as Row));
}

/**
 * Upsert a player's progress for a game. Existing save state is preserved and
 * merged, and play time is accumulated, so partial saves never wipe progress.
 */
export async function saveProgress(
  userId: string,
  gameId: string,
  patch: GameProgressPatch = {},
): Promise<GameProgress> {
  const existing = await loadProgress(userId, gameId);
  const now = new Date().toISOString();

  const playSeconds =
    patch.playSeconds != null
      ? patch.playSeconds
      : (existing?.playSeconds ?? 0) + (patch.addPlaySeconds ?? 0);

  const row = {
    user_id: userId,
    game_id: gameId,
    game_title: patch.gameTitle ?? existing?.gameTitle ?? null,
    game_image: patch.gameImage ?? existing?.gameImage ?? null,
    progress: mergeProgress(existing?.progress ?? {}, patch.progress ?? {}) as Json,
    score: patch.score ?? existing?.score ?? 0,
    level: patch.level ?? existing?.level ?? 1,
    play_seconds: Math.max(0, Math.floor(playSeconds)),
    completed: patch.completed ?? existing?.completed ?? false,
    last_played_at: patch.playedNow === false ? (existing?.lastPlayedAt ?? now) : now,
  };

  const { data, error } = await supabase
    .from("game_progress")
    .upsert(row, { onConflict: "user_id,game_id" })
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as unknown as Row);
}

/** Remove a player's save for a game. */
export async function deleteProgress(userId: string, gameId: string): Promise<void> {
  const { error } = await supabase
    .from("game_progress")
    .delete()
    .eq("user_id", userId)
    .eq("game_id", gameId);
  if (error) throw error;
}
