// runtime.ts — Embeddable game runtime using Canvas API.
// Mounts a game instance onto a <canvas> element.
// The runtime is self-contained: no creator UI logic inside.

import { eventBus, EngineEvents } from "./eventBus";
import type { GamePackage } from "./gameLoader";

export interface GameInstance {
  destroy(): void;
  submitScore(score: number): void;
  getState(): GameState;
}

export interface GameState {
  score: number;
  level: number;
  isRunning: boolean;
  isGameOver: boolean;
  startedAt: number;
  data: Record<string, unknown>;
}

/**
 * Mount a game onto a canvas element.
 * Returns a handle to control the instance.
 *
 * The runtime runs a simple render loop and emits events.
 * Game-specific logic is driven by the `gameplay` config from the package.
 */
export function mountGame(
  canvas: HTMLCanvasElement,
  pkg: GamePackage,
  playerId?: string
): GameInstance {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");

  // --- Game state ---
  const state: GameState = {
    score: 0,
    level: 1,
    isRunning: true,
    isGameOver: false,
    startedAt: Date.now(),
    data: {},
  };

  // Apply gameplay config (e.g., difficulty, levels, custom settings)
  const gameplay = pkg.gameplay ?? {};
  const difficulty = (gameplay.difficulty as string) ?? "medium";
  const maxLevels = (gameplay.levels as number) ?? 3;

  // --- Canvas sizing ---
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  };
  resize();
  window.addEventListener("resize", resize);

  // --- Render loop ---
  let rafId: number;
  const loop = () => {
    if (!state.isRunning) return;

    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#0f0f23";
    ctx.fillRect(0, 0, w, h);

    // Draw game info
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px monospace";
    ctx.fillText(`Score: ${state.score}`, 20, 40);
    ctx.font = "16px monospace";
    ctx.fillText(`Level: ${state.level} / ${maxLevels}`, 20, 65);
    ctx.fillText(`Difficulty: ${difficulty}`, 20, 90);

    // Draw a simple animated shape based on score
    const t = Date.now() / 1000;
    const x = w / 2 + Math.sin(t) * 100;
    const y = h / 2 + Math.cos(t * 0.7) * 50;
    const radius = 20 + Math.min(state.score / 100, 30);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${(state.score * 2) % 360}, 70%, 60%)`;
    ctx.fill();

    // Score ticking up (demo gameplay)
    if (!state.isGameOver) {
      state.score += 1;
      if (state.score % 500 === 0) {
        state.level = Math.min(state.level + 1, maxLevels);
        eventBus.emit(EngineEvents.LevelChange, { level: state.level });
      }
      eventBus.emit(EngineEvents.Score, { score: state.score });
    }

    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);

  // --- Public API ---
  const instance: GameInstance = {
    destroy() {
      state.isRunning = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    },

    submitScore(score: number) {
      state.score = score;
    },

    getState() {
      return { ...state };
    },
  };

  // Emit ready event
  eventBus.emit(EngineEvents.Ready, { state });

  return instance;
}
