// gameSnapshot.ts — turn the 2D game into a portable PNG.
//
// 2D assets are "different from 3D": there is no mesh geometry to export,
// so File ▸ Export As for 2D produces a real rendered frame of the game
// (captured from a hidden runtime mount) plus a gameplay JSON the player
// engine can run. Falls back to a themed "cover" frame if capture fails.
import { mountGame } from "@/engine/runtime";
import type { GamePackage } from "@/engine/gameLoader";

export interface GameplayLike {
  dimension?: string;
  mode?: string;
  theme?: { bg: string; player: string; good: string; bad: string; accent: string; text: string };
  names?: { player: string; good: string; bad: string };
}

/** Renders the real game once, offscreen, and returns a PNG Blob. */
export function captureGamePng(pkg: GamePackage, width = 960, height = 540): Promise<Blob | null> {
  return new Promise((resolve) => {
    let holder: HTMLDivElement | null = null;
    let inst: ReturnType<typeof mountGame> | null = null;
    let done = false;
    const finish = (blob: Blob | null) => {
      if (done) return;
      done = true;
      try {
        inst?.destroy();
      } catch {
        /* noop */
      }
      holder?.remove();
      resolve(blob);
    };
    // Hard timeout so a broken package never hangs the export.
    const timer = setTimeout(() => finish(null), 2500);
    try {
      holder = document.createElement("div");
      holder.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:${height}px;pointer-events:none;z-index:-1;`;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      holder.appendChild(canvas);
      document.body.appendChild(holder);
      inst = mountGame(canvas, pkg, "export-snapshot");
      let ticks = 0;
      const tick = () => {
        if (done) {
          clearTimeout(timer);
          return;
        }
        if (++ticks >= 8) {
          clearTimeout(timer);
          canvas.toBlob((b) => finish(b), "image/png");
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/** Theme-based cover frame — the safe fallback (always resolves). */
export function themedCoverPng(gameplay: GameplayLike, title: string): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(new Blob());
      return;
    }
    const theme: NonNullable<GameplayLike["theme"]> = {
      bg: "#0b1026",
      player: "#6ee7ff",
      good: "#ffd166",
      bad: "#ff4d6d",
      accent: "#a78bfa",
      text: "#e6edf7",
      ...(gameplay.theme ?? {}),
    };
    const bg = theme.bg;
    const player = theme.player;
    const good = theme.good;
    const bad = theme.bad;
    const accent = theme.accent;
    const text = theme.text;

    const grad = ctx.createLinearGradient(0, 0, 0, 540);
    grad.addColorStop(0, bg);
    grad.addColorStop(1, "#0a0a12");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);

    // Decorative falling shapes (the game's language).
    const rand = (n: number) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
    for (let i = 0; i < 26; i++) {
      const x = ((rand(i * 3 + 1) + 1) / 2) * 960;
      const y = ((rand(i * 3 + 2) + 1) / 2) * 540;
      const r = 8 + rand(i) * 22;
      ctx.globalAlpha = 0.5 + rand(i * 7) * 0.4;
      ctx.fillStyle = i % 3 === 0 ? good : i % 3 === 1 ? bad : accent;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player ball.
    ctx.fillStyle = player;
    ctx.beginPath();
    ctx.arc(480, 470, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = text;
    ctx.font = "600 34px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title || "NexPlay", 480, 120);
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillStyle = `${text}99`;
    ctx.fillText(`${(gameplay.mode ?? "catch").toUpperCase()} · ${(gameplay.dimension ?? "2d").toUpperCase()}`, 480, 150);

    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillStyle = text;
    ctx.fillText("Made with NexStudio", 480, 508);
    canvas.toBlob((b) => resolve(b ?? new Blob()), "image/png");
  });
}

/** Best-effort: real game frame, else themed cover. */
export async function exportGamePng(pkg: GamePackage, title: string): Promise<Blob> {
  const live = await captureGamePng(pkg);
  if (live && live.size > 0) return live;
  return themedCoverPng(pkg.gameplay ?? {}, title);
}