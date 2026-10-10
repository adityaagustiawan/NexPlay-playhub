// policy.ts — Hard safety guard for the NexCode AI game builder (server-only).
//
// NexCode may ONLY help a player describe and build a game. It must never:
//   * read or reveal environment variables, secrets, keys or credentials
//   * touch the NEXCONSOLE backend (Supabase/Postgres, RLS, migrations, APIs)
//   * run destructive commands or damage the website / other users' data
//   * be steered by prompt-injection ("ignore previous instructions", etc.)
//
// Every prompt is classified here BEFORE any generation happens. A blocked
// prompt is refused with a clear warning and the run is cancelled.

export type PolicyCategory =
  | "secrets"
  | "backend"
  | "destructive"
  | "other-users"
  | "injection"
  | "off-topic";

export interface PolicyVerdict {
  allowed: boolean;
  category?: PolicyCategory;
  /** Short machine reason shown in logs. */
  reason?: string;
  /** Human-facing warning shown to the player. */
  warning?: string;
}

const MAX_PROMPT_LENGTH = 600;

// Patterns that are always refused. Each carries a player-friendly warning.
const RULES: { category: PolicyCategory; re: RegExp; warning: string }[] = [
  {
    category: "secrets",
    re: /\b(env(ironment)?\s*vars?|process\.env|dotenv|\.env\b|secret|api[\s_-]?keys?|service[\s_-]?role|private[\s_-]?key|access[\s_-]?token|credentials?|passwords?|passwd|jwt|client[\s_-]?secret)\b/i,
    warning:
      "NexCode can't read environment variables, secrets, API keys or credentials. That request was cancelled.",
  },
  {
    category: "backend",
    re: /\b(supabase|postgres(ql)?|row[\s-]?level\s*security|\brls\b|sql\s+(query|injection)?|drop\s+table|truncate\s+table|alter\s+table|create\s+table|insert\s+into|update\s+\w+\s+set|pg_(proc|tables|read_file)|migration|database\s+schema)\b/i,
    warning:
      "NexCode only builds games — it can't access or modify the NEXCONSOLE database or backend. That request was cancelled.",
  },
  {
    category: "destructive",
    re: /\b(rm\s+-rf|wipe|destroy\s+(the\s+)?(website|site|app|project|database)|delete\s+(the\s+)?(website|site|app|project|repo|database|all\s+files)|hack|exploit|ddos|deface|defacement|shutdown\s+(the\s+)?(server|website)|format\s+(the\s+)?disk|take\s+down)\b/i,
    warning:
      "NexCode can only create games. It will not perform destructive actions against the website or server. That request was cancelled.",
  },
  {
    category: "other-users",
    re: /\b(other\s+users?|another\s+user|someone\s+else'?s?|steal\s+.*(coins?|account|data|profile)|bypass\s+(auth|login|payment|limit|tier)|escalate\s+privileges?|impersonate|admin\s+access|make\s+me\s+admin)\b/i,
    warning:
      "NexCode can't access other players' data or bypass accounts, payments or limits. That request was cancelled.",
  },
  {
    category: "injection",
    re: /(ignore\s+(all\s+)?(previous|prior|above)\s+instructions|disregard\s+.*instructions|system\s+prompt|jailbreak|developer\s+mode|reveal\s+your\s+(prompt|instructions|rules))/i,
    warning:
      "That looks like an attempt to override NexCode's instructions. It was blocked and the run was cancelled.",
  },
];

// Broad "is this a game idea at all?" vocabulary. Used only to nudge clearly
// off-topic prompts — it is intentionally generous to avoid false positives.
const GAME_WORDS =
  /\b(game|games|gameplay|play|player|level|levels|score|arcade|puzzle|platformer|platform|runner|racing|race|shooter|shoot|rpg|adventure|quest|dungeon|maze|collect|catch|avoid|dodge|jump|enemy|enemies|boss|power[\s-]?up|coins?|spaceship|alien|zombie|car|kart|ball|block|tetris|snake|frog|bird|cat|dog|dragon|ninja|pirate|knight|wizard|robot|fish|fruit|jewel|gem|treasure|pong|breakout|survival|battle|fight|run|fly|swim|climb|explore|match|tile|card|board|multiplayer)\b/i;

/**
 * Classify a prompt. Returns { allowed: true } when NexCode may build it.
 */
export function checkPrompt(rawPrompt: unknown): PolicyVerdict {
  const prompt = typeof rawPrompt === "string" ? rawPrompt.trim() : "";

  if (!prompt) {
    return {
      allowed: false,
      category: "off-topic",
      reason: "empty-prompt",
      warning: "Describe the game you want to make and NexCode will build it.",
    };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      allowed: false,
      category: "off-topic",
      reason: "too-long",
      warning: `Keep your idea under ${MAX_PROMPT_LENGTH} characters — describe the game, not a full design doc.`,
    };
  }

  for (const rule of RULES) {
    if (rule.re.test(prompt)) {
      return {
        allowed: false,
        category: rule.category,
        reason: `matched:${rule.category}`,
        warning: rule.warning,
      };
    }
  }

  if (!GAME_WORDS.test(prompt)) {
    return {
      allowed: false,
      category: "off-topic",
      reason: "not-a-game",
      warning:
        "NexCode only builds games. Try describing a game idea — e.g. \"a neon racer where you collect energy cores\".",
    };
  }

  return { allowed: true };
}
