// saveGame.ts — Player progress persistence.
// Autosaves to localStorage every 5s + on beforeunload.
// Syncs to Supabase player_progress table when online.
// On reload: local first, then cloud.

import { supabase } from "@/integrations/supabase/client";
import { asJson } from "@/lib/supabaseJson";
import { eventBus, EngineEvents } from "@/engine/eventBus";

const AUTOSAVE_INTERVAL_MS = 5000;

/**
 * Generate the localStorage key for a game's saved state.
 */
function storageKey(gameKey: string, playerId: string): string {
  return `nexplay:${gameKey}:${playerId}`;
}

/**
 * Load saved game state. Tries localStorage first, then falls back to cloud.
 */
export async function loadGameState(
  gameKey: string,
  playerId: string
): Promise<Record<string, unknown> | null> {
  // 1. Try local first
  try {
    const raw = localStorage.getItem(storageKey(gameKey, playerId));
    if (raw) {
      const parsed = JSON.parse(raw);
      console.log(`[save] Loaded local save for ${gameKey}`);
      return parsed;
    }
  } catch (err) {
    console.warn("[save] Failed to read local save:", err);
  }

  // 2. Fall back to cloud (need to find game_id from game_key)
  try {
    const { data: game } = await supabase
      .from("games")
      .select("id")
      .eq("game_key", gameKey)
      .maybeSingle();

    if (!game) return null;

    const { data, error } = await supabase
      .from("player_progress")
      .select("data")
      .eq("game_id", game.id)
      .eq("player_id", playerId)
      .maybeSingle();

    if (error) {
      console.warn("[save] Failed to load cloud save:", error.message);
      return null;
    }

    if (data) {
      console.log(`[save] Loaded cloud save for ${gameKey}`);
      return data.data as Record<string, unknown>;
    }
  } catch (err) {
    console.warn("[save] Cloud save fetch error:", err);
  }

  return null;
}

/**
 * Save game state to localStorage (always) and sync to cloud (if online).
 */
export async function saveGameState(
  gameKey: string,
  playerId: string,
  state: Record<string, unknown>
): Promise<void> {
  // 1. Always save locally
  try {
    localStorage.setItem(storageKey(gameKey, playerId), JSON.stringify(state));
    console.log(`[save] Local save written for ${gameKey}`);
  } catch (err) {
    console.warn("[save] Failed to write local save:", err);
  }

  // 2. Sync to cloud if online
  if (navigator.onLine) {
    try {
      // Find game_id from game_key
      const { data: game } = await supabase
        .from("games")
        .select("id")
        .eq("game_key", gameKey)
        .maybeSingle();

      if (!game) {
        console.warn("[save] Game not found for cloud sync");
        return;
      }

      const { error } = await supabase.from("player_progress").upsert(
        {
          game_id: game.id,
          player_id: playerId,
          data: asJson(state),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_id,player_id" }
      );

      if (error) {
        console.warn("[save] Cloud sync failed:", error.message);
      } else {
        console.log(`[save] Cloud sync done for ${gameKey}`);
      }
    } catch (err) {
      console.warn("[save] Cloud sync error:", err);
    }
  } else {
    console.log("[save] Offline — skipping cloud sync");
  }
}

/**
 * Start autosave loop. Returns a stop function.
 */
export function startAutosave(
  gameKey: string,
  playerId: string,
  getState: () => Record<string, unknown>
): () => void {
  // Autosave interval
  const intervalId = setInterval(() => {
    const state = getState();
    saveGameState(gameKey, playerId, state);
    eventBus.emit(EngineEvents.AutoSave, { gameKey, playerId, state });
  }, AUTOSAVE_INTERVAL_MS);

  // Save on page hide / beforeunload
  const onBeforeUnload = () => {
    const state = getState();
    localStorage.setItem(storageKey(gameKey, playerId), JSON.stringify(state));
    console.log(`[save] beforeunload save for ${gameKey}`);
  };

  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener("pagehide", onBeforeUnload);

  // Return stop function
  return () => {
    clearInterval(intervalId);
    window.removeEventListener("beforeunload", onBeforeUnload);
    window.removeEventListener("pagehide", onBeforeUnload);
  };
}

/**
 * Handle offline/online transitions.
 */
export function setupConnectivityHandlers(
  gameKey: string,
  playerId: string,
  getState: () => Record<string, unknown>
): () => void {
  const onOnline = () => {
    console.log("[save] Connection restored — pushing local save to cloud");
    const state = getState();
    saveGameState(gameKey, playerId, state);
  };

  const onOffline = () => {
    console.log("[save] Connection lost — switching to local-only mode");
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}
