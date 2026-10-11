// aiProviders.ts — provider + model catalogue for the NexPlay AI ("Muse").
//
// Ported idea from the Free-Gpt Blender addon (github.com/haseebahmed295/Free-Gpt)
// which drives 81 free models via g4f (no API key). In the browser we can't run
// g4f, so instead we catalogue OpenAI-compatible endpoints, including several
// free / keyless ones, plus a local "CLI bridge" option (Ollama / LM Studio)
// and a fully offline heuristic planner that needs no network at all.

export type AIPlugin = "offline" | "api" | "cli";

export interface ProviderPreset {
  id: string;
  label: string;
  /** OpenAI-compatible base URL ("" for the offline planner). */
  base: string;
  /** Suggested models for this provider. */
  models: string[];
  /** True when the provider has a free tier or is keyless. */
  free?: boolean;
  /** True when it normally lives on the local machine (CLI/bridge). */
  local?: boolean;
  /** Short note shown in the settings panel. */
  note?: string;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: "offline",
    label: "Muse · offline (free, no key)",
    base: "",
    models: ["muse-local"],
    free: true,
    note: "Rule-based game builder. Always works, never leaves your browser.",
  },
  {
    id: "pollinations",
    label: "Pollinations (free, keyless)",
    base: "https://text.pollinations.ai/openai",
    models: ["openai", "mistral", "llama"],
    free: true,
    note: "Keyless OpenAI-compatible endpoint. Great default for 'free GPT'.",
  },
  {
    id: "groq",
    label: "Groq (free tier)",
    base: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
    free: true,
  },
  {
    id: "cerebras",
    label: "Cerebras (free tier)",
    base: "https://api.cerebras.ai/v1",
    models: ["llama3.1-8b", "llama3.1-70b", "llama-3.3-70b"],
    free: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter (free models)",
    base: "https://openrouter.ai/api/v1",
    models: [
      "meta-llama/llama-3.1-8b-instruct:free",
      "google/gemma-2-9b-it:free",
      "mistralai/mistral-7b-instruct:free",
      "qwen/qwen-2.5-7b-instruct:free",
    ],
    free: true,
  },
  {
    id: "ollama",
    label: "Ollama / LM Studio (local bridge)",
    base: "http://localhost:11434/v1",
    models: ["llama3.1", "qwen2.5", "mistral"],
    local: true,
    note: "Point at a local OpenAI-compatible server — the web equivalent of a CLI plugin.",
  },
  {
    id: "openai",
    label: "OpenAI",
    base: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  },
  {
    id: "g4f",
    label: "g4f / gpt4free (self-hosted)",
    base: "http://localhost:1337/v1",
    models: ["gpt-4o-mini", "gpt-4", "claude-3-haiku"],
    local: true,
    note: "Run `g4f api` locally for keyless access to many providers.",
  },
];

export interface AIConfig {
  plugin: AIPlugin;
  providerId: string;
  base: string;
  key: string;
  model: string;
}

export function findProvider(id: string): ProviderPreset {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/** The config a fresh install should start with: free + keyless. */
export function defaultAIConfig(): AIConfig {
  const p = findProvider("pollinations");
  return { plugin: "offline", providerId: p.id, base: p.base, key: "", model: p.models[0] };
}

/** All models across all providers, de-duplicated, for a flat picker. */
export function allModels(): { provider: string; model: string; free?: boolean }[] {
  const out: { provider: string; model: string; free?: boolean }[] = [];
  for (const p of PROVIDERS) for (const m of p.models) out.push({ provider: p.id, model: m, free: p.free });
  return out;
}
