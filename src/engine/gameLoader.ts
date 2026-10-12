// gameLoader.ts — Loads a "game package" JSON from Supabase.
// Game package shape: { gameplay, assets, scripts? }

import { supabase } from "@/integrations/supabase/client";
import { asRecord } from "@/lib/supabaseJson";

export interface GamePackage {
  gameplay: Record<string, unknown>;
  assets: Record<string, unknown>;
  scripts?: string;
  title?: string;
  version?: number;
}

export interface GameRecord {
  id: string;
  game_key: string;
  title: string;
  description: string | null;
  gameplay: Record<string, unknown>;
  assets: Record<string, unknown>;
  version: number;
  released_at: string | null;
  user_id: string;
  status: string | null;
  is_draft: boolean;
  /** Editor-only data (source, edit time, serialized 3D scene + animation). */
  studio_data?: Record<string, unknown> | null;
}

/**
 * Load a game package by its unique game_key.
 * Returns the gameplay + assets JSON needed by the runtime.
 */
export async function loadGamePackage(gameKey: string): Promise<GamePackage> {
  const { data, error } = await supabase
    .from("games")
    .select("title, version, gameplay, assets")
    .eq("game_key", gameKey)
    .maybeSingle();

  if (error) {
    console.error("[gameLoader] Failed to load game:", error.message);
    throw new Error(`Failed to load game "${gameKey}": ${error.message}`);
  }

  if (!data) {
    throw new Error(`Game "${gameKey}" not found`);
  }

  return {
    gameplay: asRecord(data.gameplay),
    assets: asRecord(data.assets),
    title: data.title,
    version: data.version,
  };
}

/**
 * Load full game record (for creator dashboard).
 */
export async function loadGameRecord(gameKey: string): Promise<GameRecord | null> {
  const { data, error } = await supabase
    .from("games")
    .select("id, game_key, title, description, gameplay, assets, version, released_at, user_id, status, is_draft, studio_data")
    .eq("game_key", gameKey)
    .maybeSingle();

  if (error) {
    console.error("[gameLoader] Failed to load game record:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    game_key: data.game_key,
    title: data.title,
    description: data.description,
    gameplay: asRecord(data.gameplay),
    assets: asRecord(data.assets),
    version: data.version,
    released_at: data.released_at,
    user_id: data.user_id,
    status: data.status,
    is_draft: data.is_draft,
    studio_data: asRecord(data.studio_data),
  };
}
