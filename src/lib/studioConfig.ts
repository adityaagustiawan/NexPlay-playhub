// studioConfig.ts — pure config helpers for Nexstudio (the game editor).
// Kept free of React/Supabase so the mapping to the engine's `gameplay` shape
// can be unit-tested.

export type Mode = "catch" | "shooter" | "runner";
export type Difficulty = "easy" | "medium" | "hard";
/** A game is either a 2D canvas game or a 3D world; the editor viewport follows this. */
export type Dimension = "2d" | "3d";

export interface StudioConfig {
  title: string;
  description: string;
  mode: Mode;
  dimension: Dimension;
  difficulty: Difficulty;
  levels: number;
  goal: number;
  speed: number;
  spawnMs: number;
  theme: { bg: string; player: string; good: string; bad: string; accent: string; text: string };
  names: { player: string; good: string; bad: string };
}

export const DEFAULT_CONFIG: StudioConfig = {
  title: "Untitled Game",
  description: "Built in Nexstudio.",
  mode: "catch",
  dimension: "2d",
  difficulty: "medium",
  levels: 5,
  goal: 15,
  speed: 3.4,
  spawnMs: 850,
  theme: {
    bg: "#0b1026",
    player: "#6ee7ff",
    good: "#ffd166",
    bad: "#ff4d6d",
    accent: "#a78bfa",
    text: "#e6edf7",
  },
  names: { player: "You", good: "Points", bad: "Hazards" },
};

export const GOOD_LABEL: Record<Mode, string> = {
  catch: "Collectibles",
  shooter: "Targets",
  runner: "Pickups",
};
export const BAD_LABEL: Record<Mode, string> = {
  catch: "Hazards",
  shooter: "Enemies",
  runner: "Obstacles",
};

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30) || "game"
  );
}

export function clampNumber(value: string, min: number, max: number, fallback: number): number {
  if (value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const GENRE: Record<Mode, string> = {
  catch: "Catch 'em up",
  shooter: "Arcade Shooter",
  runner: "Endless Runner",
};

/** Build the engine `gameplay` config from the editor state. */
export function buildGameplay(c: StudioConfig): Record<string, unknown> {
  return {
    mode: c.mode,
    dimension: c.dimension,
    genre: GENRE[c.mode],
    difficulty: c.difficulty,
    levels: c.levels,
    goal: c.goal,
    speed: c.speed,
    spawnMs: c.spawnMs,
    theme: c.theme,
    names: c.names,
  };
}
