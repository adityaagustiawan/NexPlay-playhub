// generator.ts — Turns a natural-language prompt into a playable NEXCONSOLE
// game config. Server-only.
//
// Deterministic by default (no external services required). If an
// OpenAI-compatible endpoint is configured (NEXCODE_LLM_API_KEY), it is used to
// refine the result; any failure falls back to the deterministic generator so
// generation never hard-fails.

export type GameMode = "catch" | "shooter" | "runner";
export type Difficulty = "easy" | "medium" | "hard";

export interface GameTheme {
  bg: string;
  player: string;
  good: string;
  bad: string;
  accent: string;
  text: string;
}

export interface GeneratedGame {
  title: string;
  description: string;
  gameplay: {
    mode: GameMode;
    genre: string;
    difficulty: Difficulty;
    levels: number;
    goal: number;
    speed: number;
    spawnMs: number;
    theme: GameTheme;
    names: { player: string; good: string; bad: string };
  };
  assets: {
    palette: string;
    generatedBy: string;
    prompt: string;
  };
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const PALETTES: Record<string, { noun: string; good: string; bad: string; theme: GameTheme }> = {
  space: { noun: "Star", good: "Energy Cores", bad: "Meteors", theme: { bg: "#0b1026", player: "#6ee7ff", good: "#ffd166", bad: "#ff4d6d", accent: "#a78bfa", text: "#e6edf7" } },
  ocean: { noun: "Ocean", good: "Pearls", bad: "Eels", theme: { bg: "#06263b", player: "#7fffd4", good: "#ffd23f", bad: "#ff6b6b", accent: "#38bdf8", text: "#e6f6ff" } },
  forest: { noun: "Forest", good: "Berries", bad: "Wasps", theme: { bg: "#0b1f12", player: "#a3e635", good: "#fbbf24", bad: "#ef4444", accent: "#34d399", text: "#e8fbe8" } },
  lava: { noun: "Volcano", good: "Embers", bad: "Lava Bombs", theme: { bg: "#2a0b0b", player: "#ffd166", good: "#ff9f1c", bad: "#ef233c", accent: "#ff7b00", text: "#ffe8e0" } },
  ice: { noun: "Glacier", good: "Snowflakes", bad: "Icicles", theme: { bg: "#0b1a2a", player: "#bde0fe", good: "#a7f3d0", bad: "#f472b6", accent: "#90e0ef", text: "#eaf6ff" } },
  desert: { noun: "Desert", good: "Treasures", bad: "Scorpions", theme: { bg: "#2b1e0e", player: "#ffd6a5", good: "#f9c74f", bad: "#e76f51", accent: "#f4a261", text: "#fff3e0" } },
  candy: { noun: "Candyland", good: "Candies", bad: "Sour Drops", theme: { bg: "#2a1030", player: "#ff8fab", good: "#ffe066", bad: "#9d4edd", accent: "#ff5d8f", text: "#ffe9f3" } },
  cyber: { noun: "Neon City", good: "Data Chips", bad: "Firewalls", theme: { bg: "#0a0118", player: "#00f5d4", good: "#fee440", bad: "#f15bb5", accent: "#9b5de5", text: "#eaeaea" } },
};

const THEME_KEYWORDS: Record<string, RegExp> = {
  space: /\b(space|star|galaxy|cosmic|planet|astro|alien|ufo|rocket|moon|orbit|nebula)\b/i,
  ocean: /\b(ocean|sea|water|fish|underwater|aquatic|shark|coral|deep[\s-]?sea|submarine)\b/i,
  forest: /\b(forest|jungle|nature|leaf|tree|wood|bamboo|garden|wilderness)\b/i,
  lava: /\b(lava|fire|flame|hell|volcano|magma|demon|dragon|inferno)\b/i,
  ice: /\b(ice|snow|winter|frozen|arctic|glacier|frost)\b/i,
  desert: /\b(desert|sand|egypt|pyramid|dune|pharaoh|sahara)\b/i,
  candy: /\b(candy|rainbow|party|sugar|sweet|cake|donut|cupcake)\b/i,
  cyber: /\b(cyber|neon|punk|hacker|synth|matrix|future|robot|ai|tech)\b/i,
};

const MODE_STRONG: Record<GameMode, RegExp> = {
  shooter: /\b(shoot(er|ing)?|blast|laser|gun|bullet|invader|defen[cs]e|asteroid|sniper|war|battle)\b/i,
  catch: /\b(catch(er|ing)?|collect|grab|gather|pick\s*up|fish(ing)?|basket|net)\b/i,
  runner: /\b(run(ner|ning)?|race|racing|dash|platform(er)?|jump|parkour|endless|obstacle)\b/i,
};

const MODE_WEAK: Record<GameMode, RegExp> = {
  shooter: /\b(zombie|alien|spaceship|ship|attack|arrow|tower)\b/i,
  catch: /\b(coin|gem|jewel|fruit|treasure|star|bubble|snowflake)\b/i,
  runner: /\b(dodge|avoid|escape|track|climb|stunt|slalom)\b/i,
};

const MODE_NOUN: Record<GameMode, string> = { catch: "Catcher", shooter: "Shooter", runner: "Runner" };
const MODE_GENRE: Record<GameMode, string> = { catch: "Catch 'em up", shooter: "Arcade Shooter", runner: "Endless Runner" };

const ADJECTIVES = ["Neon", "Turbo", "Cosmic", "Mega", "Wild", "Hyper", "Pixel", "Electric", "Ancient", "Zero-G"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickDifficulty(prompt: string): Difficulty {
  if (/\b(hard|brutal|nightmare|hardcore|difficult|insane|expert)\b/i.test(prompt)) return "hard";
  if (/\b(easy|chill|relax|casual|simple|calm|beginner)\b/i.test(prompt)) return "easy";
  return "medium";
}

function pickMode(prompt: string): GameMode {
  // Priority: shooter > runner > catch (only when explicitly signalled).
  if (MODE_KEYWORDS.shooter.test(prompt)) return "shooter";
  if (MODE_KEYWORDS.runner.test(prompt)) return "runner";
  if (MODE_KEYWORDS.catch.test(prompt)) return "catch";
  return "catch";
}

function pickThemeKey(prompt: string, seed: number): string {
  for (const [key, re] of Object.entries(THEME_KEYWORDS)) {
    if (re.test(prompt)) return key;
  }
  const keys = Object.keys(PALETTES);
  return keys[seed % keys.length];
}

function tune(difficulty: Difficulty, mode: GameMode) {
  const base = { easy: { speed: 2.4, spawnMs: 1100 }, medium: { speed: 3.4, spawnMs: 850 }, hard: { speed: 4.6, spawnMs: 620 } }[difficulty];
  return {
    speed: base.speed,
    spawnMs: mode === "runner" ? Math.round(base.spawnMs * 1.4) : base.spawnMs,
  };
}

/** Deterministic generator — always succeeds. */
export function generateLocal(prompt: string): GeneratedGame {
  const clean = prompt.replace(/\s+/g, " ").trim();
  const seed = hash(clean.toLowerCase());
  const mode = pickMode(clean);
  const themeKey = pickThemeKey(clean, seed);
  const palette = PALETTES[themeKey];
  const difficulty = pickDifficulty(clean);
  const adjective = ADJECTIVES[seed % ADJECTIVES.length];

  const title = `${adjective} ${palette.noun} ${MODE_NOUN[mode]}`;
  const description = `A ${MODE_GENRE[mode].toLowerCase()} built from your idea: "${clean.slice(0, 140)}".`;

  const names = {
    player: mode === "shooter" ? "Your Ship" : mode === "runner" ? "The Runner" : "You",
    good: palette.good,
    bad: mode === "runner" ? "Obstacles" : palette.bad,
  };

  return {
    title,
    description,
    gameplay: {
      mode,
      genre: MODE_GENRE[mode],
      difficulty,
      levels: 5,
      goal: mode === "runner" ? 1000 : 15,
      ...tune(difficulty, mode),
      theme: palette.theme,
      names,
    },
    assets: {
      palette: themeKey,
      generatedBy: "nexcode-local",
      prompt: clean.slice(0, 300),
    },
  };
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback;
}

function coerceLLMGame(raw: unknown, prompt: string): GeneratedGame | null {
  if (!raw || typeof raw !== "object") return null;
  const base = generateLocal(prompt);
  const g = raw as Record<string, any>;
  const gp = (g.gameplay ?? {}) as Record<string, any>;

  const mode: GameMode = ["catch", "shooter", "runner"].includes(gp.mode) ? gp.mode : base.gameplay.mode;
  const difficulty: Difficulty = ["easy", "medium", "hard"].includes(gp.difficulty)
    ? gp.difficulty
    : base.gameplay.difficulty;
  const theme = (gp.theme ?? {}) as Record<string, unknown>;

  const title = typeof g.title === "string" && g.title.trim() ? g.title.trim().slice(0, 60) : base.title;
  const description =
    typeof g.description === "string" && g.description.trim() ? g.description.trim().slice(0, 240) : base.description;

  return {
    title,
    description,
    gameplay: {
      mode,
      genre: typeof gp.genre === "string" ? gp.genre.slice(0, 40) : MODE_GENRE[mode],
      difficulty,
      levels: Math.min(10, Math.max(1, Number(gp.levels) || base.gameplay.levels)),
      goal: Math.max(1, Number(gp.goal) || base.gameplay.goal),
      speed: Math.min(8, Math.max(1, Number(gp.speed) || base.gameplay.speed)),
      spawnMs: Math.min(2000, Math.max(300, Number(gp.spawnMs) || base.gameplay.spawnMs)),
      theme: {
        bg: safeColor(theme.bg, base.gameplay.theme.bg),
        player: safeColor(theme.player, base.gameplay.theme.player),
        good: safeColor(theme.good, base.gameplay.theme.good),
        bad: safeColor(theme.bad, base.gameplay.theme.bad),
        accent: safeColor(theme.accent, base.gameplay.theme.accent),
        text: safeColor(theme.text, base.gameplay.theme.text),
      },
      names: {
        player: String(gp?.names?.player ?? base.gameplay.names.player).slice(0, 24),
        good: String(gp?.names?.good ?? base.gameplay.names.good).slice(0, 24),
        bad: String(gp?.names?.bad ?? base.gameplay.names.bad).slice(0, 24),
      },
    },
    assets: { palette: String(g.assets?.palette ?? base.assets.palette).slice(0, 24), generatedBy: "nexcode-llm", prompt: prompt.slice(0, 300) },
  };
}

const SYSTEM_PROMPT = [
  "You are NexCode, an AI that designs tiny 2D arcade games for NEXCONSOLE.",
  "You ONLY output a single JSON object. No prose, no markdown.",
  "You must never include code, shell commands, SQL, URLs, secrets, or references to Supabase/Postgres/NEXCONSOLE internals.",
  'Schema: {"title":string,"description":string,"gameplay":{"mode":"catch"|"shooter"|"runner","genre":string,"difficulty":"easy"|"medium"|"hard","levels":number,"goal":number,"speed":number,"spawnMs":number,"theme":{"bg":"#hex","player":"#hex","good":"#hex","bad":"#hex","accent":"#hex","text":"#hex"},"names":{"player":string,"good":string,"bad":string}}}',
].join(" ");

/** Try the optional LLM; return null on any problem. */
async function generateWithLLM(prompt: string): Promise<GeneratedGame | null> {
  const key = process.env.NEXCODE_LLM_API_KEY;
  if (!key) return null;
  const url = process.env.NEXCODE_LLM_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.NEXCODE_LLM_MODEL || "gpt-4o-mini";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Game idea: ${prompt}` },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return coerceLLMGame(JSON.parse(content), prompt);
  } catch {
    return null;
  }
}

/** Generate a game — LLM if configured, deterministic otherwise. */
export async function generateGame(prompt: string): Promise<GeneratedGame> {
  const viaLLM = await generateWithLLM(prompt);
  return viaLLM ?? generateLocal(prompt);
}
