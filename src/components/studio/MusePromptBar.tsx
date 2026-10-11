// MusePromptBar.tsx — the always-on prompt bar shown under the viewport when the
// AI is enabled. It drives the same `useMuse` controller as the side panel, so
// you can type a request right next to the scene. It also reports what Muse did
// (even when the side panel is hidden) and shows example chips so it is obvious
// how to prompt.
import { useState } from "react";
import { Sparkles, ArrowRight, Loader2, Wrench, Check } from "lucide-react";
import { MUSE_MODES, type MuseController } from "@/hooks/useMuse";
import { Tip } from "@/components/studio/Tip";

interface Props {
  muse: MuseController;
}

export function MusePromptBar({ muse }: Props) {
  const { mode, setMode, loading, messages, actions, send } = muse;
  const [input, setInput] = useState("");

  const active = MUSE_MODES.find((m) => m.id === mode) ?? MUSE_MODES[0];
  const showExamples = actions.length === 0 && messages.length <= 1 && !input;

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    setInput("");
    void send(t);
  };

  return (
    <div className="shrink-0 border-t border-[#1d1d1d] bg-[#2b2b2b]">
      {actions.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#1d1d1d] bg-[#243024] px-2 py-1 text-[10px] text-[#c7e6c7]">
          <Wrench className="h-3 w-3 shrink-0 text-[#7bd88f]" />
          <span className="shrink-0 font-medium text-[#7bd88f]">
            Muse used {actions.length} tool{actions.length === 1 ? "" : "s"}:
          </span>
          {actions.map((a, i) => (
            <span key={i} className="flex shrink-0 items-center gap-1 rounded-full bg-[#1d2a1d] px-2 py-0.5">
              <Check className="h-2.5 w-2.5" /> {a.label}
            </span>
          ))}
        </div>
      )}
      {showExamples && (
        <div className="flex items-center gap-1.5 overflow-x-auto px-2 pt-1.5 text-[10px]">
          <span className="shrink-0 text-[#8f8f8f]">Try:</span>
          {MUSE_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => submit(m.example)}
              className="shrink-0 rounded-full border border-[#454545] bg-[#333333] px-2 py-0.5 text-[#b8c8e0] hover:border-[#4772b3] hover:text-white"
            >
              {m.example}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#7bd88f]" />
        <span className="hidden shrink-0 text-[10px] uppercase tracking-wide text-[#b8b8b8] sm:inline">Muse</span>
        <Tip label="Muse mode" description="Build a whole game, edit one object, or just chat." side="top">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            title="Muse mode"
            className="h-6 shrink-0 rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-1 text-[10px] text-[#e0e0e0] outline-none focus:border-[#4772b3]"
          >
            {MUSE_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Tip>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          placeholder={`${active.label}: ${active.placeholder}`}
          disabled={loading}
          className="h-7 min-w-0 flex-1 rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-2 text-[11px] text-[#e6e6e6] outline-none placeholder:text-[#7a7a7a] focus:border-[#4772b3] disabled:opacity-50"
        />
        <Tip label="Build with Muse" description="Send the prompt — Muse creates the objects and settings." shortcut="Enter" side="top">
          <button
            type="button"
            onClick={() => submit(input)}
            disabled={loading || !input.trim()}
            title="Send to Muse"
            className="flex h-7 shrink-0 items-center gap-1 rounded-[3px] bg-[#4772b3] px-2.5 text-[11px] text-white hover:bg-[#5a85c6] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Build</span>
          </button>
        </Tip>
      </div>
    </div>
  );
}
