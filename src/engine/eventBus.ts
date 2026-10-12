// eventBus.ts — Lightweight pub/sub for engine events.
// Emits: "score", "levelChange", "autoSave", "gameOver", "ready"

export type EventHandler = (data?: unknown) => void;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, data?: unknown): void {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`[eventBus] Error in handler for "${event}":`, err);
      }
    });
  }
}

/** Global engine event bus singleton */
export const eventBus = new EventBus();

/** Convenience typed helpers */
export const EngineEvents = {
  Score: "score",
  LevelChange: "levelChange",
  AutoSave: "autoSave",
  GameOver: "gameOver",
  Ready: "ready",
} as const;
