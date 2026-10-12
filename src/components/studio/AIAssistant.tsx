// AIAssistant.tsx — "Muse", the AI side panel for NexPlay Studio.
//
// Presentational: all of the conversation state lives in `useMuse` so the side
// panel and the viewport prompt bar share one conversation. Inspired by
// BlenderGPT and the Free-Gpt Blender addon.
import { useEffect, useRef, useState } from "react";
import { Bot, Check, Loader2, Send, Settings2, Sparkles, Trash2, Wrench } from "lucide-react";
import { PROVIDERS, findProvider, type AIPlugin } from "@/lib/aiProviders";
import { MUSE_MODES, type MuseController } from "@/hooks/useMuse";

interface Props {
  muse: MuseController;
}

export function AIAssistant({ muse }: Props) {
  const { messages, loading, actions, mode, setMode, ai, setAi, offline, send, clear, chooseProvider, choosePlugin } = muse;
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, actions]);

  const provider = findProvider(ai.providerId);
  const keyStatus = ai.key ? "key set" : offline ? "no key needed" : "no key";

  const submit = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    void send(text);
  };

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
          <button type="button" title="Clear chat" onClick={clear} className="rounded-[3px] p-1 text-[#b0b0b0] hover:bg-[#3a3a3a]">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-[#1d1d1d] bg-[#2b2b2b] px-2 py-1">
        {MUSE_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
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
              submit();
            }
          }}
          placeholder={MUSE_MODES.find((m) => m.id === mode)?.placeholder}
          disabled={loading}
          className="h-7 flex-1 rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-2 text-[11px] outline-none focus:border-[#4772b3] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
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
