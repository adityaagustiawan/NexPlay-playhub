// ScriptingEditor.tsx — the code view of the game script. The engine's game
// script is its gameplay.json; here you can hand-edit it as code and apply the
// result. Kept in sync with the visual Game Logic editor.
import { useMemo, useState } from "react";
import { AlertTriangle, Braces, Save, Wand2 } from "lucide-react";
import { buildGameplay, configFromGameplay, type StudioConfig } from "@/lib/studioConfig";

interface Props {
  config: StudioConfig;
  setConfig: (cfg: StudioConfig) => void;
  onApply: () => void;
}

const editorCls =
  "min-h-0 w-full flex-1 resize-none bg-[#1d1f24] p-3 font-mono text-[11.5px] leading-relaxed text-[#b8d8c0] outline-none placeholder:text-[#5a6570]";

export function ScriptingEditor({ config, setConfig, onApply }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generated = useMemo(() => JSON.stringify(buildGameplay(config), null, 2), [config]);
  const value = text ?? generated;

  const applyJson = () => {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setError("gameplay.json must be a JSON object.");
        return;
      }
      setConfig(configFromGameplay(parsed, config));
      setError(null);
      onApply();
    } catch (err) {
      setError(`Invalid JSON — ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#232428] text-[12px] text-[#d7d7d7]">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[#1d1f23] bg-[#2e3036] px-3">
        <Braces size={13} className="text-[#8fb0e0]" />
        <span className="font-heading uppercase tracking-wide text-[#cfcfcf]">gameplay.json</span>
        <span className="text-[10px] text-[#7a8696]">the engine's script file · edit as code</span>
        <div className="ml-auto flex items-center gap-2">
          {error && (
            <span className="flex max-w-[220px] items-center gap-1 truncate text-[10px] text-[#e6957f]" title={error}>
              <AlertTriangle size={11} /> {error}
            </span>
          )}
          <button
            type="button"
            onClick={() => setText(generated)}
            className="flex h-6 items-center gap-1 rounded-[3px] border border-[#3a3a3a] px-2 text-[11px] text-[#a0a0a0] hover:bg-[#3a3a3a]"
          >
            <Wand2 size={11} /> Re-sync
          </button>
          <button
            type="button"
            onClick={applyJson}
            className="flex h-6 items-center gap-1 rounded-[3px] bg-[#4772b3] px-2.5 text-[11px] font-medium text-white hover:bg-[#5683c7]"
          >
            <Save size={11} /> Apply &amp; Save
          </button>
        </div>
      </div>
      <textarea
        value={value}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        className={editorCls}
      />
    </div>
  );
}