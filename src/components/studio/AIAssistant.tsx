// AIAssistant.tsx — "Muse", the AI panel for NexPlay Studio.
//
// Inspired by BlenderGPT and the Free-Gpt Blender addon: describe what you want
// and the assistant builds it into the game. It can run fully offline (a
// rule-based planner, no key, no network), or talk to any OpenAI-compatible
// endpoint — including free/keyless providers and a local CLI bridge (Ollama /
// LM Studio / g4f). When it acts, the studio shows what Muse is doing.
import { useEffect, useRef, useState } from "react";
import { Bot, Check, Loader2, Send, Settings2, Sparkles, Trash2, Wrench } from "lucide-react";
import { PROVIDERS, defaultAIConfig, findProvider, type AIConfig, type AIPlugin } from "@/lib/aiProviders";
import { diffConfig, mergeConfig, museSystemPrompt, planGame, type MuseAction } from "@/lib/musePlan";
import type { StudioConfig } from "@/lib/studioConfig";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Props {
  config: StudioConfig;
  /** Called with a fully-formed next config when Muse builds or edits the game. */
  onApplyConfig?: (next: StudioConfig, actions: MuseAction[]) => void;
  /** Called while Muse is working (a label) and with null when it is done. */
  onActivity?: (label: string | null) => void;
}

type MuseMode = "build" | "object" | "edit" | "chat";

const MODES: { id: MuseMode; label: string; placeholder: string }[] = [
  { id: "build", label: "Build", placeholder: "Describe a whole game… e.g. 'a hard 3D space shooter'" },
  { id: "object", label: "Object", placeholder: "Add an object… e.g. 'add a giant red enemy'" },
  { id: "edit", label: "Edit", placeholder: "What should change? e.g. 'make it faster, 3 levels'" },
  { id: "chat", label: "Chat", placeholder: "Ask about NexPlay or your game…" },
];

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

function modeGreeting(mode: MuseMode): string {
  switch (mode) {
    case "build":
      return "Tell me the game you want and I'll build it — mode, dimension, theme, difficulty, all of it. Try “a chill ocean runner” or “a brutal 3D shooter”.";
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

export function AIAssistant({ config, onApplyConfig, onActivity }: Props) {
  const [messages, setMessages] = useState<AIMessage[]>([{ role: "assistant", content: modeGreeting("build") }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<MuseMode>("build");
  const [ai, setAi] = useState<AIConfig>(loadCfg);
  const [showSettings, setShowSettings] = useState(false);
  const [actions, setActions] = useState<MuseAction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, actions]);

  useEffect(() => {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(ai));
    } catch {
      /* ignore */
    }
  }, [ai]);

  const provider = findProvider(ai.providerId);
  const offline = ai.plugin === "offline" || !ai.base || ai.model === "muse-local";

  const chooseProvider = (id: string) => {
    const p = findProvider(id);
    setAi((a) => ({
      ...a,
      providerId: id,
      base: p.base || a.base,
      model: p.models[0] ?? a.model,
      plugin: id === "offline" ? "offline" : a.plugin === "offline" ? "api" : a.plugin,
    }));
  };

  const choosePlugin = (plugin: AIPlugin) => {
    setAi((a) => {
      if (plugin === "offline") return { ...a, plugin };
      if (plugin === "cli" && !findProvider(a.providerId).local) {
        const p = findProvider("ollama");
        return { ...a, plugin, providerId: p.id, base: p.base, model: p.models[0] };
      }
      const p = findProvider(a.providerId);
      if (p.id === "offline") {
        const fallback = findProvider("pollinations");
        return { ...a, plugin, providerId: fallback.id, base: fallback.base, model: fallback.models[0] };
      }
      return { ...a, plugin };
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
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
        onApplyConfig?.(plan.config, plan.actions);
        setActions(plan.actions);
        setMessages((m) => [...m, { role: "assistant", content: actionSummary(plan.rationale, plan.actions) }]);
        onActivity?.(null);
        return;
      }

      // Real provider (API or local CLI bridge).
      onActivity?.("Muse is thinking…");
      const sys = building ? museSystemPrompt(config) : "You are a helpful assistant inside NexPlay Studio, a Blender-style 2D/3D game editor. Reply concisely in markdown.";
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
      const parsed = parseModelConfigSafe(content);
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
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", content: modeGreeting(mode) }]);
    setActions([]);
    onActivity?.(null);
  };

  const switchMode = (m: MuseMode) => {
    setMode(m);
    setMessages([{ role: "assistant", content: modeGreeting(m) }]);
    setActions([]);
  };

  const keyStatus = ai.key ? "key set" : offline ? "no key needed" : "no key";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#282828] text-[11px] text-[#d0d0d0]">
      {/* Header */}
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-[#1d1d1d] bg-[#303030] px-3">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-[#7bd88f]" />
          <span className="font-heading uppercase tracking-wide text-[#b8b8b8]">Muse · AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" title="Settings" onClick={() => setShowSettings((s) => !s)} className={`rounded-[3px] p-1 hover:bg-[#3a3a3a] ${showSettings ? "text-white" : "text-[#b0b0b0]"}`}>
            <Settings2 className="h-3 w-3" />
          </button>
          <button type="button" title="Clear chat" onClick={clearChat} className="rounded-[3px] p-1 text-[#b0b0b0] hover:bg-[#3a3a3a]">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-[#1d1d1d] bg-[#2b2b2b] px-2 py-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => switchMode(m.id)}
            className={`rounded-[3px] px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              mode === m.id ? "bg-[#4772b3] text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Model picker + plugins */}
      <div className="flex shrink-0 flex-col gap-1 border-b border-[#1d1d1d] bg-[#2b2b2b] px-2 py-1.5">
        <div className="flex items-center gap-1">
          <span className="w-11 shrink-0 text-[10px] uppercase text-[#8f8f8f]">Model</span>
          <select
            value={ai.providerId}
            onChange={(e) => chooseProvider(e.target.value)}
            className="h-6 min-w-0 flex-1 rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-1 text-[10px] text-[#e0e0e0] outline-none focus:border-[#4772b3]"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-11 shrink-0 text-[10px] uppercase text-[#8f8f8f]">Use</span>
          <select
            value={provider.models.includes(ai.model) ? ai.model : "__custom"}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "__custom") setAi((a) => ({ ...a, model: v }));
            }}
            className="h-6 min-w-0 flex-1 rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-1 text-[10px] text-[#e0e0e0] outline-none focus:border-[#4772b3]"
          >
            {provider.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {!provider.models.includes(ai.model) && <option value="__custom">{ai.model || "custom…"}</option>}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-11 shrink-0 text-[10px] uppercase text-[#8f8f8f]">Plugin</span>
          {(["offline", "api", "cli"] as AIPlugin[]).map((pl) => (
            <button
              key={pl}
              type="button"
              onClick={() => choosePlugin(pl)}
              title={pl === "offline" ? "Rule-based, no network" : pl === "api" ? "OpenAI-compatible HTTP" : "Local bridge (Ollama/LM Studio/g4f)"}
              className={`rounded-[3px] px-2 py-0.5 text-[10px] uppercase ${
                ai.plugin === pl ? "bg-[#4772b3] text-white" : "bg-[#3a3a3a] text-[#b0b0b0] hover:bg-[#454545]"
              }`}
            >
              {pl}
            </button>
          ))}
          <span className="ml-auto text-[9px] text-[#8f8f8f]">{keyStatus}</span>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-[#1d1d1d] bg-[#2b2b2b] p-2">
          <div>
            <div className="mb-0.5 text-[10px] uppercase text-[#8f8f8f]">API base URL</div>
            <input
              value={ai.base}
              onChange={(e) => setAi((a) => ({ ...a, base: e.target.value }))}
              placeholder="https://… (empty = offline)"
              className="h-6 w-full rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-1.5 text-[10px] outline-none focus:border-[#4772b3]"
            />
          </div>
          <div>
            <div className="mb-0.5 text-[10px] uppercase text-[#8f8f8f]">Model</div>
            <input
              value={ai.model}
              onChange={(e) => setAi((a) => ({ ...a, model: e.target.value }))}
              placeholder="llama-3.1-8b-instant, openai, gpt-4o-mini…"
              className="h-6 w-full rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-1.5 text-[10px] outline-none focus:border-[#4772b3]"
            />
          </div>
          <div>
            <div className="mb-0.5 text-[10px] uppercase text-[#8f8f8f]">API key (optional for free/keyless)</div>
            <input
              type="password"
              value={ai.key}
              onChange={(e) => setAi((a) => ({ ...a, key: e.target.value }))}
              placeholder="sk-… (leave blank for keyless)"
              className="h-6 w-full rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-1.5 text-[10px] outline-none focus:border-[#4772b3]"
            />
          </div>
          <div className="text-[9px] leading-relaxed text-[#8f8f8f]">
            {provider.note ?? "Free endpoints: Pollinations (keyless), Groq, Cerebras, OpenRouter :free. CLI: run Ollama / LM Studio / g4f locally and point the base at it."}
          </div>
        </div>
      )}

      {/* What Muse did */}
      {actions.length > 0 && (
        <div className="shrink-0 border-b border-[#1d1d1d] bg-[#243024] px-2 py-1.5">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#7bd88f]">
            <Wrench className="h-3 w-3" /> Muse used {actions.length} tool{actions.length === 1 ? "" : "s"}
          </div>
          <ul className="flex flex-col gap-0.5">
            {actions.map((a, i) => (
              <li key={i} className="flex items-start gap-1 text-[10px] text-[#c7e6c7]">
                <Check className="mt-0.5 h-2.5 w-2.5 shrink-0" /> {a.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-[4px] px-2 py-1.5 text-[11px] leading-relaxed ${
                  msg.role === "user" ? "bg-[#4772b3] text-white" : "bg-[#3a3a3a] text-[#d0d0d0]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-1.5 text-[#9fd6a8]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-[10px]">Muse is working…</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex shrink-0 gap-1 border-t border-[#1d1d1d] bg-[#2b2b2b] p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={MODES.find((m) => m.id === mode)?.placeholder}
          disabled={loading}
          className="h-7 flex-1 rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-2 text-[11px] outline-none focus:border-[#4772b3] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          title="Send to Muse"
          className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#4772b3] text-white hover:bg-[#5a85c6] disabled:opacity-50"
        >
          {mode === "chat" ? <Send className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// Local helpers -------------------------------------------------------------

function parseModelConfigSafe(text: string) {
  // lazy import avoidance: re-implement the tiny wrapper through musePlan.
  return parseModelConfig(text);
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
