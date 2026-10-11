// musePlan.ts — the offline "Muse" game planner plus parsing helpers for real
// models. Pure (no React/network) so it can be unit-tested.
//
// `planGame(prompt)` turns a natural-language request into a full StudioConfig
// using rules, so the AI can build a game even with no API key and no network.
// `parseModelConfig(text)` extracts a config patch from an LLM response when a
// real provider is configured.

import {
  DEFAULT_CONFIG,
  clampNumber,
  slugify,
  type Difficulty,
  type Dimension,
  type Mode,
  type StudioConfig,
} from "./studioConfig";

export interface MuseAction {
  tool: string;
  label: string;
}

export interface MusePlan {
  config: StudioConfig;
  actions: MuseAction[];
  rationale: string;
  source: "offline" | "model";
}

type Theme = StudioConfig["theme"];

const THEMES: Record<string, Theme> = {
  neon: { bg: "#0a0a12", player: "#39ff14", good: "#ff00e5", bad: "#ff3131", accent: "#00e5ff", text: "#eafcff" },
  space: { bg: "#05060f", player: "#7dd3fc", good: "#fde68a", bad: "#f43f5e", accent: "#818cf8", text: "#e5e7ff" },
  fire: { bg: "#140806", player: "#ffd166", good: "#ffb703", bad: "#ef233c", accent: "#ff7b00", text: "#ffe8d6" },
  ice: { bg: "#071a24", player: "#dff6ff", good: "#8ecae6", bad: "#e63946", accent: "#48cae4", text: "#eafaff" },
  forest: { bg: "#07160e", player: "#a3e635", good: "#facc15", bad: "#dc2626", accent: "#22c55e", text: "#e9fce9" },
  ocean: { bg: "#04121f", player: "#7ee8fa", good: "#ffd166", bad: "#ff6b6b", accent: "#38bdf8", text: "#e6f7ff" },
  sunset: { bg: "#1a0b1e", player: "#ffd6a5", good: "#ffadad", bad: "#e63946", accent: "#ff7b00", text: "#ffe8f0" },
  candy: { bg: "#1b0f1f", player: "#ffc2e2", good: "#ffe066", bad: "#ff5d8f", accent: "#c084fc", text: "#fff0f6" },
  desert: { bg: "#1c1408", player: "#ffe8b0", good: "#f4a261", bad: "#bc4749", accent: "#e9c46a", text: "#fff4dd" },
  mono: { bg: "#0d0d0d", player: "#e5e5e5", good: "#a3a3a3", bad: "#525252", accent: "#737373", text: "#f5f5f5" },
  retro: { bg: "#04140a", player: "#33ff66", good: "#aaff00", bad: "#ff3355", accent: "#00cc66", text: "#d8ffe0" },
};

const DIFFICULTY_FACTORS: Record<Difficulty, { levels: number; goal: number; speed: number; spawnMs: number }> = {
  easy: { levels: 3, goal: 10, speed: 2.6, spawnMs: 1100 },
  medium: { levels: 5, goal: 15, speed: 3.4, spawnMs: 850 },
  hard: { levels: 8, goal: 25, speed: 5.2, spawnMs: 520 },
};

const THEME_WORDS: [RegExp, keyof typeof THEMES][] = [
  [/neon|cyber|synth|glow/, "neon"],
  [/space|galaxy|cosmic|star|spaceship|alien|asteroid|orbit/, "space"],
  [/fire|lava|volcano|inferno|flame|magma/, "fire"],
  [/ice|snow|frozen|frost|arctic|winter/, "ice"],
  [/forest|jungle|nature|wood|tree|leaf/, "forest"],
  [/ocean|underwater|sea|aquatic|fish|coral/, "ocean"],
  [/sunset|dusk|twilight|horizon/, "sunset"],
  [/candy|sweet|pink|bubblegum|unicorn/, "candy"],
  [/desert|sand|dune|egypt|pyramid/, "desert"],
  [/mono|monochrome|grayscale|noir|black.?and.?white/, "mono"],
  [/retro|terminal|arcade|8.?bit|pixel|matrix|hacker/, "retro"],
];

const MODE_WORDS: [RegExp, Mode][] = [
  [/shoot|gun|fire|enemy|enemies|blast|bullet|fps|sniper|galaga|invader/, "shooter"],
  [/run|endless|dodge|obstacle|jump|parkour|sprint|side.?scroll/, "runner"],
];

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function detectDimension(p: string): Dimension {
  if (/\b3d\b|three.?d|voxel|first.?person|fps|low.?poly|perspective|depth|block.?world/.test(p)) return "3d";
  return "2d";
}

function detectMode(p: string): Mode {
  for (const [re, m] of MODE_WORDS) if (re.test(p)) return m;
  return "catch";
}

function detectDifficulty(p: string): Difficulty {
  if (/easy|casual|chill|relax|beginner|simple|for kids/.test(p)) return "easy";
  if (/hard|insane|brutal|nightmare|difficult|extreme|impossible|expert/.test(p)) return "hard";
  return "medium";
}

function detectTheme(p: string): keyof typeof THEMES | null {
  for (const [re, key] of THEME_WORDS) if (re.test(p)) return key;
  return null;
}

function detectTitle(prompt: string, mode: Mode, dim: Dimension, themeKey: keyof typeof THEMES | null): string {
  const explicit = prompt.match(/(?:called|named|titled?|title\s*[:=])\s*["']?([^"'\n,.]{2,40})["']?/i);
  if (explicit) return titleCase(explicit[1].trim());
  const quoted = prompt.match(/["']([^"']{2,40})["']/);
  if (quoted) return titleCase(quoted[1].trim());
  const noun = mode === "shooter" ? "Shooter" : mode === "runner" ? "Runner" : "Catcher";
  const prefix =
    themeKey && themeKey !== "mono" ? titleCase(themeKey) : dim === "3d" ? "Voxel" : "Neon";
  return `${prefix} ${noun}`;
}

function detectGoal(p: string): number | null {
  const m =
    p.match(/(?:goal|win|reach)\D{0,8}(\d{1,3})/) ||
    p.match(/(\d{1,3})\s*(?:to win|points|collect|coins?|stars?|targets?|items?)/);
  if (m) return clampNumber(m[1], 1, 999, DEFAULT_CONFIG.goal);
  return null;
}

function detectLevels(p: string): number | null {
  const m = p.match(/(\d{1,2})\s*(?:levels?|stages?|worlds?|rounds?)/);
  if (m) return clampNumber(m[1], 1, 10, DEFAULT_CONFIG.levels);
  return null;
}

function detectSpeed(p: string): number | null {
  if (/faster|fast|quick|speed up|hyper|sonic/.test(p)) return 6;
  if (/slow|chill|calm|gentle/.test(p)) return 2;
  return null;
}

/** Plan a whole game from a free-text prompt, with no network access. */
export function planGame(prompt: string, base: StudioConfig = DEFAULT_CONFIG): MusePlan {
  const p = prompt.toLowerCase();
  const actions: MuseAction[] = [];

  const dimension = detectDimension(p);
  const mode = detectMode(p);
  const difficulty = detectDifficulty(p);
  const themeKey = detectTheme(p);
  const theme = themeKey ? { ...THEMES[themeKey] } : { ...base.theme };
  const factors = DIFFICULTY_FACTORS[difficulty];

  const levels = detectLevels(p) ?? factors.levels;
  const goal = detectGoal(p) ?? factors.goal;
  const speed = detectSpeed(p) ?? factors.speed;
  const spawnMs = factors.spawnMs;

  const title = detectTitle(prompt, mode, dimension, themeKey);

  // Names derived from the mode, with a light nod to the prompt's theme word.
  const goodName = mode === "shooter" ? "Targets" : mode === "runner" ? "Pickups" : "Coins";
  const badName = mode === "shooter" ? "Enemies" : mode === "runner" ? "Obstacles" : "Hazards";
  const names = { player: themeKey ? titleCase(themeKey) + " Hero" : base.names.player, good: goodName, bad: badName };

  const config: StudioConfig = {
    ...base,
    title,
    description: prompt.trim() || base.description,
    mode,
    dimension,
    difficulty,
    levels,
    goal,
    speed,
    spawnMs,
    theme,
    names,
  };

  actions.push({ tool: "set_dimension", label: `Set viewport to ${dimension.toUpperCase()}` });
  actions.push({ tool: "set_mode", label: `Game mode → ${mode}` });
  actions.push({ tool: "set_difficulty", label: `Difficulty → ${difficulty}` });
  if (themeKey) actions.push({ tool: "set_theme", label: `Applied the "${themeKey}" theme` });
  actions.push({ tool: "set_goal", label: `Goal → ${goal} · Levels → ${levels}` });
  actions.push({ tool: "set_speed", label: `Speed → ${speed.toFixed(1)} · Spawn every ${spawnMs}ms` });
  actions.push({ tool: "set_name", label: `Named it “${title}”` });

  return {
    config,
    actions,
    rationale: `Built a ${difficulty} ${dimension.toUpperCase()} ${mode} game named “${title}”.`,
    source: "offline",
  };
}

/** Extract a JSON config patch from an LLM response (fenced or bare). */
export function parseModelConfig(text: string): { rationale?: string; config?: Partial<StudioConfig> } | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1]);
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) candidates.push(brace[0]);
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c.trim()) as { rationale?: string; config?: Partial<StudioConfig> };
      if (obj && typeof obj === "object" && (obj.config || obj.rationale)) return obj;
    } catch {
      // try next candidate
    }
  }
  return null;
}

const MODES: Mode[] = ["catch", "shooter", "runner"];
const DIMENSIONS: Dimension[] = ["2d", "3d"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/** Merge a (possibly partial / untrusted) model patch into a valid config. */
export function mergeConfig(base: StudioConfig, patch: Partial<StudioConfig> | undefined): StudioConfig {
  if (!patch || typeof patch !== "object") return base;
  const out: StudioConfig = { ...base };
  if (typeof patch.title === "string" && patch.title.trim()) out.title = patch.title.trim().slice(0, 80);
  if (typeof patch.description === "string") out.description = patch.description.slice(0, 400);
  if (MODES.includes(patch.mode as Mode)) out.mode = patch.mode as Mode;
  if (DIMENSIONS.includes(patch.dimension as Dimension)) out.dimension = patch.dimension as Dimension;
  if (DIFFICULTIES.includes(patch.difficulty as Difficulty)) out.difficulty = patch.difficulty as Difficulty;
  if (patch.levels != null) out.levels = clampNumber(String(patch.levels), 1, 10, base.levels);
  if (patch.goal != null) out.goal = clampNumber(String(patch.goal), 1, 999, base.goal);
  if (patch.speed != null) out.speed = clampNumber(String(patch.speed), 1, 8, base.speed);
  if (patch.spawnMs != null) out.spawnMs = clampNumber(String(patch.spawnMs), 300, 2000, base.spawnMs);
  if (patch.theme && typeof patch.theme === "object") out.theme = { ...base.theme, ...patch.theme };
  if (patch.names && typeof patch.names === "object") out.names = { ...base.names, ...patch.names };
  return out;
}

/** Describe, as tool-like actions, what changed between two configs. */
export function diffConfig(prev: StudioConfig, next: StudioConfig): MuseAction[] {
  const acts: MuseAction[] = [];
  if (prev.title !== next.title) acts.push({ tool: "set_title", label: `Title → “${next.title}”` });
  if (prev.description !== next.description) acts.push({ tool: "set_description", label: "Updated the description" });
  if (prev.dimension !== next.dimension) acts.push({ tool: "set_dimension", label: `Viewport → ${next.dimension.toUpperCase()}` });
  if (prev.mode !== next.mode) acts.push({ tool: "set_mode", label: `Game mode → ${next.mode}` });
  if (prev.difficulty !== next.difficulty) acts.push({ tool: "set_difficulty", label: `Difficulty → ${next.difficulty}` });
  if (prev.levels !== next.levels) acts.push({ tool: "set_levels", label: `Levels → ${next.levels}` });
  if (prev.goal !== next.goal) acts.push({ tool: "set_goal", label: `Goal → ${next.goal}` });
  if (prev.speed !== next.speed) acts.push({ tool: "set_speed", label: `Speed → ${next.speed.toFixed(1)}` });
  if (prev.spawnMs !== next.spawnMs) acts.push({ tool: "set_spawn", label: `Spawn every ${next.spawnMs}ms` });
  if (JSON.stringify(prev.theme) !== JSON.stringify(next.theme)) acts.push({ tool: "set_theme", label: "Re-themed the world" });
  if (JSON.stringify(prev.names) !== JSON.stringify(next.names)) acts.push({ tool: "set_names", label: "Renamed the scene elements" });
  return acts;
}

/** The instruction sent to a real model so it replies with a config patch. */
export function museSystemPrompt(config: StudioConfig): string {
  return [
    "You are Muse, the AI game builder inside NexPlay Studio, a Blender-style 2D/3D game editor.",
    "Given a request, design a playable game. Respond with ONE fenced json block and nothing else:",
    "```json",
    '{ "rationale": "one short sentence", "config": { "title": "...", "description": "...", "mode": "catch|shooter|runner", "dimension": "2d|3d", "difficulty": "easy|medium|hard", "levels": 1-10, "goal": 1-999, "speed": 1-8, "spawnMs": 300-2000, "theme": { "bg": "#hex", "player": "#hex", "good": "#hex", "bad": "#hex", "accent": "#hex", "text": "#hex" }, "names": { "player": "...", "good": "...", "bad": "..." } } }',
    "```",
    "Only include fields you are changing. Never include code or prose outside the json block.",
    `Current config: ${JSON.stringify(config)}`,
  ].join("\n");
}
