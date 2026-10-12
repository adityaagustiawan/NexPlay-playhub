// runtime.ts — Embeddable 2D arcade runtime (Canvas API).
// Mounts a game instance onto a <canvas>. Self-contained: no creator UI here.
//
// Game behaviour is data-driven from the package `gameplay` config produced by
// the NexCode generator:
//   { mode: "catch" | "shooter" | "runner", difficulty, goal, speed, spawnMs,
//     theme: { bg, player, good, bad, accent, text },
//     names: { player, good, bad } }
//
// Controls: Arrow keys / WASD to move, Space to shoot & jump, or drag/tap.
// 3 lives. Score submits on game over.

import { eventBus, EngineEvents } from "./eventBus";
import type { GamePackage } from "./gameLoader";

export interface GameInstance {
  destroy(): void;
  submitScore(score: number): void;
  getState(): GameState;
  /** Pause or resume the simulation (Unity-style play mode). */
  setPaused(paused: boolean): void;
}

export interface GameState {
  score: number;
  level: number;
  isRunning: boolean;
  isGameOver: boolean;
  startedAt: number;
  data: Record<string, unknown>;
}

type Mode = "catch" | "shooter" | "runner";

interface Theme {
  bg: string;
  player: string;
  good: string;
  bad: string;
  accent: string;
  text: string;
}

interface Entity {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  good: boolean;
}

interface Bullet {
  x: number;
  y: number;
}

const DEFAULT_THEME: Theme = {
  bg: "#0f172a",
  player: "#60a5fa",
  good: "#fbbf24",
  bad: "#f87171",
  accent: "#818cf8",
  text: "#e2e8f0",
};

export function mountGame(
  canvas: HTMLCanvasElement,
  pkg: GamePackage,
  playerId?: string
): GameInstance {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");

  // --- Config ---
  const gameplay = (pkg.gameplay ?? {}) as Record<string, any>;
  const mode: Mode = ["catch", "shooter", "runner"].includes(gameplay.mode)
    ? gameplay.mode
    : "catch";
  const theme: Theme = { ...DEFAULT_THEME, ...(gameplay.theme ?? {}) };
  const names = {
    player: String(gameplay.names?.player ?? "You"),
    good: String(gameplay.names?.good ?? "Points"),
    bad: String(gameplay.names?.bad ?? "Hazards"),
  };
  const goal = typeof gameplay.goal === "number" ? gameplay.goal : 15;
  const seedSpeed = typeof gameplay.speed === "number" ? gameplay.speed : 3.4;
  const spawnMs = typeof gameplay.spawnMs === "number" ? gameplay.spawnMs : 850;
  const maxLevels = typeof gameplay.levels === "number" ? gameplay.levels : 5;

  // --- State ---
  const startedAt = Date.now();
  const state: GameState = {
    score: 0,
    level: 1,
    isRunning: true,
    isGameOver: false,
    startedAt,
    data: {},
  };
  let lives = 3;
  let playerX = 0;
  let playerTargetX = 0;
  let playerY = 0; // runner: vertical position (top of player)
  let playerVY = 0;
  let onGround = true;
  let lastSpawn = 0;
  let lastShot = 0;
  let message = "";
  let messageUntil = 0;
  let paused = false;

  const UP = new Set(["ArrowUp", "w", "W", " "]);
  const DOWN = new Set(["ArrowDown", "s", "S"]);
  const LEFT = new Set(["ArrowLeft", "a", "A"]);
  const RIGHT = new Set(["ArrowRight", "d", "D"]);
  const pressed = new Set<string>();

  const entities: Entity[] = [];
  const bullets: Bullet[] = [];

  // --- Canvas sizing (DPR-aware, transform reset each resize) ---
  let w = 0;
  let h = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    w = rect.width;
    h = rect.height;
    if (playerX === 0) {
      playerX = w / 2;
      playerTargetX = w / 2;
    }
    if (playerY === 0) playerY = h - 48;
  };
  resize();
  window.addEventListener("resize", resize);

  // --- Input ---
  const isTypingTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    // Never hijack keys while the player is typing in a form field.
    if (isTypingTarget(e.target)) return;
    pressed.add(e.key);
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    // Always release the key, even if the event landed on a form field.
    pressed.delete(e.key);
  };
  const clearKeys = () => pressed.clear();

  const pointerPos = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return e.clientX - rect.left;
  };
  const onPointerMove = (e: PointerEvent) => {
    playerTargetX = pointerPos(e);
  };
  const onPointerDown = (e: PointerEvent) => {
    playerTargetX = pointerPos(e);
    if (mode === "runner") tryJump();
    if (mode === "shooter") fire();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearKeys);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.style.touchAction = "none";

  const playerW = 46;
  const playerH = 16;

  function tryJump() {
    if (mode === "runner" && onGround && !state.isGameOver) {
      playerVY = -12;
      onGround = false;
    }
  }

  function fire() {
    if (state.isGameOver) return;
    const now = Date.now();
    if (now - lastShot < 200) return;
    lastShot = now;
    bullets.push({ x: playerX, y: playerY - 6 });
  }

  function spawn() {
    const r = 9 + Math.random() * 7;
    if (mode === "catch") {
      const good = Math.random() < 0.68;
      entities.push({
        x: r + Math.random() * Math.max(1, w - r * 2),
        y: -r,
        r,
        vy: (seedSpeed + Math.random() * seedSpeed) * 0.9,
        vx: 0,
        good,
      });
    } else if (mode === "shooter") {
      entities.push({
        x: r + Math.random() * Math.max(1, w - r * 2),
        y: -r,
        r,
        vy: seedSpeed * 0.75 + Math.random() * seedSpeed * 0.5,
        vx: (Math.random() - 0.5) * 1.2,
        good: false,
      });
    } else {
      // runner: obstacle + occasional coin
      const isCoin = Math.random() < 0.22;
      entities.push({
        x: w + r,
        y: isCoin ? h - 90 - Math.random() * 40 : h - 44 - r,
        r: isCoin ? 8 : 12 + Math.random() * 12,
        vy: 0,
        vx: -(seedSpeed * 2.4 + state.level * 0.25),
        good: isCoin,
      });
    }
  }

  function loseLife() {
    lives -= 1;
    message = lives > 0 ? `Life lost! ${lives} left` : "Game over";
    messageUntil = Date.now() + 900;
    if (lives <= 0) endGame();
  }

  let gameOverEmitted = false;
  function endGame() {
    if (gameOverEmitted) return;
    gameOverEmitted = true;
    state.isGameOver = true;
    state.isRunning = false;
    eventBus.emit(EngineEvents.GameOver, { score: state.score });
  }

  // --- Render loop ---
  let rafId = 0;
  let last = performance.now();
  let lastScoreEmit = 0;

  const loop = (now: number) => {
    const dtMs = Math.min(50, now - last);
    last = now;
    const f = dtMs / 16.67; // normalise to 60fps frames

    if (state.isGameOver) {
      drawGameOver();
      return;
    }

    // --- Movement input ---
    let move = 0;
    if (pressed.has("ArrowLeft") || pressed.has("a") || pressed.has("A")) move -= 1;
    if (pressed.has("ArrowRight") || pressed.has("d") || pressed.has("D")) move += 1;
    if (move !== 0) playerTargetX = playerX + move * 9;
    playerTargetX = Math.max(playerW / 2, Math.min(w - playerW / 2, playerTargetX));
    playerX += (playerTargetX - playerX) * Math.min(1, 0.3 * f);

    if (mode === "shooter") {
      if (pressed.has(" ") || pressed.has("ArrowUp")) fire();
    }
    if (mode === "runner") {
      if (pressed.has(" ") || pressed.has("ArrowUp")) tryJump();
    }

    // --- Spawning ---
    if (now - lastSpawn > spawnMs) {
      lastSpawn = now;
      spawn();
      if (mode === "runner" && state.level > 1 && Math.random() < 0.4) spawn();
    }

    // --- Player physics (runner) ---
    if (mode === "runner") {
      playerVY += 0.62 * f;
      playerY += playerVY * f;
      const groundY = h - 48;
      if (playerY >= groundY) {
        playerY = groundY;
        playerVY = 0;
        onGround = true;
      }
      state.score += dtMs * 0.05 * (1 + state.level * 0.05);
    } else {
      playerY = mode === "shooter" ? h - 42 : h - 40;
    }

    // --- Bullets ---
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= 13 * f;
      if (bullets[i].y < -10) bullets.splice(i, 1);
    }

    // --- Entities ---
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      e.y += e.vy * f;
      e.x += e.vx * f;

      // Removal off-screen
      if (mode === "runner") {
        if (e.x < -40) {
          entities.splice(i, 1);
          continue;
        }
      } else if (e.y > h + 40) {
        if (e.good && mode === "catch") {
          // missed a collectible — no penalty
        }
        entities.splice(i, 1);
        continue;
      }

      // Player collision
      const closestX = Math.max(playerX - playerW / 2, Math.min(e.x, playerX + playerW / 2));
      const closestY = Math.max(playerY - playerH / 2, Math.min(e.y, playerY + playerH / 2));
      const dx = e.x - closestX;
      const dy = e.y - closestY;
      if (dx * dx + dy * dy < e.r * e.r) {
        entities.splice(i, 1);
        if (mode === "catch") {
          if (e.good) {
            state.score += 1;
          } else {
            loseLife();
          }
        } else if (mode === "runner") {
          if (e.good) {
            state.score += 50;
          } else {
            loseLife();
          }
        } else {
          loseLife();
        }
        continue;
      }

      // Bullet collision (shooter)
      if (mode === "shooter") {
        for (let b = bullets.length - 1; b >= 0; b--) {
          const bu = bullets[b];
          const bdx = e.x - bu.x;
          const bdy = e.y - bu.y;
          if (bdx * bdx + bdy * bdy < e.r * e.r) {
            bullets.splice(b, 1);
            entities.splice(i, 1);
            state.score += 2;
            break;
          }
        }
      }

      if (state.isGameOver) break;
    }

    // --- Level progression ---
    if (mode !== "runner") {
      const targetLevel = Math.min(maxLevels, Math.floor(state.score / goal) + 1);
      if (targetLevel > state.level) {
        state.level = targetLevel;
        eventBus.emit(EngineEvents.LevelChange, { level: state.level });
        message = `Level ${state.level}!`;
        messageUntil = Date.now() + 800;
      }
    } else if (state.score >= goal * state.level && state.level < maxLevels) {
      state.level += 1;
      eventBus.emit(EngineEvents.LevelChange, { level: state.level });
    }

    // --- Score event (throttled) ---
    if (now - lastScoreEmit > 250) {
      lastScoreEmit = now;
      eventBus.emit(EngineEvents.Score, { score: Math.floor(state.score) });
    }

    draw();
    rafId = requestAnimationFrame(loop);
  };

  function roundRect(x: number, y: number, width: number, height: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawPlayer() {
    ctx.fillStyle = theme.player;
    if (mode === "runner") {
      roundRect(playerX - playerW / 2, playerY - 26, playerW, 26, 6);
    } else {
      roundRect(playerX - playerW / 2, playerY - playerH / 2, playerW, playerH, 8);
    }
    ctx.fill();
  }

  function drawBackground() {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    // subtle grid
    ctx.strokeStyle = theme.accent + "22";
    ctx.lineWidth = 1;
    const grid = 40;
    for (let x = 0; x < w; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    if (mode === "runner") {
      ctx.fillStyle = theme.accent + "33";
      ctx.fillRect(0, h - 44, w, 44);
      ctx.fillStyle = theme.accent + "66";
      ctx.fillRect(0, h - 44, w, 3);
    }
  }

  function drawHud() {
    ctx.fillStyle = theme.text;
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Score ${Math.floor(state.score)}`, 14, 26);
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText(`Level ${state.level}/${maxLevels}`, 14, 46);

    // Lives
    ctx.textAlign = "right";
    ctx.fillStyle = theme.text;
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText(`Lives`, w - 14, 26);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w - 20 - i * 16, 42, 6, 0, Math.PI * 2);
      ctx.fillStyle = i < lives ? theme.bad : theme.text + "33";
      ctx.fill();
    }
    ctx.textAlign = "left";

    if (message && Date.now() < messageUntil) {
      ctx.textAlign = "center";
      ctx.fillStyle = theme.accent;
      ctx.font = "bold 16px ui-monospace, monospace";
      ctx.fillText(message, w / 2, 80);
      ctx.textAlign = "left";
    }
  }

  function draw() {
    drawBackground();

    // Entities
    for (const e of entities) {
      if (mode === "runner" && !e.good) {
        ctx.fillStyle = theme.bad;
        roundRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2, 4);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = e.good ? theme.good : theme.bad;
        ctx.fill();
        ctx.strokeStyle = theme.bg;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Bullets
    ctx.fillStyle = theme.accent;
    for (const b of bullets) {
      ctx.fillRect(b.x - 2, b.y - 10, 4, 12);
    }

    drawPlayer();
    drawHud();

    // First-run hint
    if (Date.now() - startedAt < 4200) {
      ctx.textAlign = "center";
      ctx.fillStyle = theme.text + "cc";
      ctx.font = "13px ui-monospace, monospace";
      const hint =
        mode === "runner"
          ? "Space / Tap to jump"
          : mode === "shooter"
            ? "Move: ← →    Shoot: Space"
            : `Move: ← →    Collect ${names.good} · avoid ${names.bad}`;
      ctx.fillText(hint, w / 2, h - 16);
      ctx.textAlign = "left";
    }
  }

  function drawGameOver() {
    drawBackground();
    ctx.textAlign = "center";
    ctx.fillStyle = theme.text;
    ctx.font = "bold 30px ui-monospace, monospace";
    ctx.fillText("Game Over", w / 2, h / 2 - 10);
    ctx.font = "16px ui-monospace, monospace";
    ctx.fillText(`Final score: ${Math.floor(state.score)}`, w / 2, h / 2 + 22);
    ctx.textAlign = "left";
  }

  rafId = requestAnimationFrame(loop);
  eventBus.emit(EngineEvents.Ready, { state, mode, playerId });

  const instance: GameInstance = {
    destroy() {
      state.isRunning = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
    },
    submitScore(score: number) {
      state.score = score;
    },
    getState() {
      return { ...state };
    },
  };

  return instance;
}
