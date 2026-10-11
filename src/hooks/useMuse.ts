// useMuse.ts — shared controller for the NexPlay "Muse" AI assistant.
//
// The state lives here (not in the panel) so the side panel and the viewport
// prompt bar drive the same conversation. Muse runs offline by default (a
// rule-based planner, no key, no network) or against any OpenAI-compatible
// endpoint, including free/keyless providers and a local CLI bridge.
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { defaultAIConfig, findProvider, type AIConfig, type AIPlugin } from "@/lib/aiProviders";
import {
  diffConfig,
  mergeConfig,
  museSystemPrompt,
  parseModelConfig,
  planGame,
  type MuseAction,
} from "@/lib/musePlan";
import type { StudioConfig } from "@/lib/studioConfig";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type MuseMode = "build" | "object" | "edit" | "chat";

export const MUSE_MODES: { id: MuseMode; label: string; placeholder: string; example: string }[] = [
  { id: "build", label: "Build", placeholder: "Describe a whole game… e.g. 'a hard 3D space shooter'", example: "a hard 3D space shooter called Nova" },
  { id: "object", label: "Object", placeholder: "Add an object… e.g. 'add a giant red enemy'", example: "add a giant red enemy" },
  { id: "edit", label: "Edit", placeholder: "What should change? e.g. 'make it faster, 3 levels'", example: "make it faster with 3 levels" },
  { id: "chat", label: "Chat", placeholder: "Ask about NexPlay or your game…", example: "how do I switch to 3D?" },
];

export function museGreeting(mode: MuseMode): string {
  switch (mode) {
    case "build":
      return "Tell me the game you want and I'll build it — mode, dimension, theme and difficulty. Try “a chill ocean runner” or “a brutal 3D shooter”.";
    case "object":
      return "Tell me what to add and I'll place it in the scene (player, collectibles, hazards, colours).";
    case "edit":
      return "Tell me what to change — speed, levels, difficulty, theme, names.";
    default:
      return "Ask me anything about NexPlay Studio or your game.";
  }
}

function actionSummary(rationale: string, actions: MuseAction[]): string {
  const lines = actions.map((a) => `- ${a.label}`).join("\n");
  return `**${rationale}**\n\n**Tools used**\n${lines || "- (no changes)"}`;
}

const CFG_KEY = "nexstudio_ai_cfg";

function loadCfg(): AIConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AIConfig>;
      if (p && typeof p.providerId === "string") return { ...defaultAIConfig(), ...p };
    }
  } catch {
    /* ignore */
  }
  return defaultAIConfig();
}

function offlineChat(text: string, config: StudioConfig): string {
  const t = text.toLowerCase();
  if (/key|api|model|provider|plugin/.test(t)) {
    return "Set a provider under **Model → Plugin**, or use **Offline** (no key). Free keyless option: Pollinations. Local option: run Ollama/LM Studio and use the **CLI** plugin.";
  }
  if (/dimension|2d|3d/.test(t)) {
    return `This game is currently **${config.dimension.toUpperCase()}**. Switch it in the viewport header, or tell me “make it 3D” in Build mode.`;
  }
  return `I'm running in **offline** mode (rule-based). I can build or edit games from a description. This game is a ${config.difficulty} ${config.dimension.toUpperCase()} ${config.mode} titled “${config.title}”. For free-form chat, pick a real model under Model → Plugin.`;
}

export interface MuseController {
  messages: AIMessage[];
  loading: boolean;
  actions: MuseAction[];
  mode: MuseMode;
  setMode: (m: MuseMode) => void;
  ai: AIConfig;
  setAi: Dispatch<SetStateAction<AIConfig>>;
  offline: boolean;
  send: (text: string) => Promise<void>;
  clear: () => void;
  chooseProvider: (id: string) => void;
  choosePlugin: (p: AIPlugin) => void;
}

export function useMuse(
  config: StudioConfig,
  onApplyConfig?: (next: StudioConfig, actions: MuseAction[]) => void,
  onActivity?: (label: string | null) => void,
): MuseController {
  const [messages, setMessages] = useState<AIMessage[]>([{ role: "assistant", content: museGreeting("build") }]);
  const [loading, setLoading] = useState(false);
  const [mode, setModeState] = useState<MuseMode>("build");
  const [ai, setAi] = useState<AIConfig>(loadCfg);
  const [actions, setActions] = useState<MuseAction[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(ai));
    } catch {
      /* ignore */
    }
  }, [ai]);

  const offline = ai.plugin === "offline" || !ai.base || ai.model === "muse-local";

  const setMode = useCallback((m: MuseMode) => {
    setModeState(m);
    setMessages([{ role: "assistant", content: museGreeting(m) }]);
    setActions([]);
    onActivity?.(null);
  }, [onActivity]);

  const clear = useCallback(() => {
    setMessages([{ role: "assistant", content: museGreeting(mode) }]);
    setActions([]);
    onActivity?.(null);
  }, [mode, onActivity]);

  const chooseProvider = useCallback((id: string) => {
    const p = findProvider(id);
    setAi((a) => ({
      ...a,
      providerId: id,
      base: p.base || a.base,
      model: p.models[0] ?? a.model,
      plugin: id === "offline" ? "offline" : a.plugin === "offline" ? "api" : a.plugin,
    }));
  }, []);

  const choosePlugin = useCallback((plugin: AIPlugin) => {
    setAi((a) => {
      if (plugin === "offline") return { ...a, plugin };
      if (plugin === "cli" && !findProvider(a.providerId).local) {
        const p = findProvider("ollama");
        return { ...a, plugin, providerId: p.id, base: p.base, model: p.models[0] };
      }
      if (findProvider(a.providerId).id === "offline") {
        const p = findProvider("pollinations");
        return { ...a, plugin, providerId: p.id, base: p.base, model: p.models[0] };
      }
      return { ...a, plugin };
    });
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;
      setActions([]);
      setMessages((m) => [...m, { role: "user", content: text }]);
      setLoading(true);
      const building = mode !== "chat";

      try {
        if (offline) {
          if (!building) {
            setMessages((m) => [...m, { role: "assistant", content: offlineChat(text, config) }]);
            return;
          }
          onActivity?.("Muse is creating…");
          // Give the overlay a beat so the studio visibly shows the AI working.
          await new Promise((r) => setTimeout(r, 420));
          const plan = planGame(text, config);
          // "Object" mode only places/renames things; "Build"/"Edit" retune the game.
          const next: StudioConfig =
            mode === "object"
              ? {
                  ...config,
                  dimension: plan.config.dimension,
                  theme: plan.config.theme,
                  names: plan.config.names,
                  description: plan.config.description,
                }
              : plan.config;
          const acts = diffConfig(config, next);
          onApplyConfig?.(next, acts);
          setActions(acts);
          setMessages((m) => [...m, { role: "assistant", content: actionSummary(plan.rationale, acts) }]);
          onActivity?.(null);
          return;
        }

        // Real provider (API or local CLI bridge).
        onActivity?.("Muse is thinking…");
        const sys = building
          ? museSystemPrompt(config)
          : "You are a helpful assistant inside NexPlay Studio, a Blender-style 2D/3D game editor. Reply concisely in markdown.";
        const res = await fetch(`${ai.base.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(ai.key ? { Authorization: `Bearer ${ai.key}` } : {}),
          },
          body: JSON.stringify({
            model: ai.model,
            messages: [
              { role: "system", content: sys },
              ...messages.slice(-8).filter((m) => m.role !== "system"),
              { role: "user", content: text },
            ],
            temperature: building ? 0.6 : 0.7,
            max_tokens: 1200,
          }),
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        const content: string = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";

        if (!building) {
          setMessages((m) => [...m, { role: "assistant", content: content || "(empty response)" }]);
          onActivity?.(null);
          return;
        }

        onActivity?.("Muse is building…");
        const parsed = parseModelConfig(content);
        if (parsed) {
          const next = mergeConfig(config, parsed.config);
          const acts = diffConfig(config, next);
          onApplyConfig?.(next, acts);
          setActions(acts);
          setMessages((m) => [
            ...m,
            { role: "assistant", content: actionSummary(parsed.rationale || "Applied your changes.", acts) },
          ]);
        } else {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: content || "I couldn't turn that into a game — try describing it differently." },
          ]);
        }
        onActivity?.(null);
      } catch (err) {
        onActivity?.(null);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `⚠ ${err instanceof Error ? err.message : "Request failed"}. Muse's offline mode works with no key — switch Plugins to “Offline”, or set an endpoint in Settings.`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [ai, config, loading, messages, mode, offline, onActivity, onApplyConfig],
  );

  return {
    messages,
    loading,
    actions,
    mode,
    setMode,
    ai,
    setAi,
    offline,
    send,
    clear,
    chooseProvider,
    choosePlugin,
  };
}
