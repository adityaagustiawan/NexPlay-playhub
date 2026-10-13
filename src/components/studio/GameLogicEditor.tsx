// GameLogicEditor.tsx — the studio's "visual code" for the game script.
// Game rules are authored as visual blocks and compiled into the exact
// gameplay.json the engine player executes (buildGameplay). No engine code runs
// in the editor — the blocks ARE the script; Apply writes the real file.
import { useMemo, useState } from "react";
import {
  Blocks,
  Check,
  RotateCcw,
  Rocket,
  Save,
  Settings2,
  Sparkles,
  Swords,
  Target,
  Wand2,
  Zap,
} from "lucide-react";
import { BAD_LABEL, GOOD_LABEL, buildGameplay, type Mode, type StudioConfig } from "@/lib/studioConfig";

interface Props {
  config: StudioConfig;
  setConfig: (cfg: StudioConfig) => void;
  onApply: () => void;
  onPlay: () => void;
}

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "catch", label: "Catch", blurb: "collect falling goodies, dodge the bad" },
  { id: "shooter", label: "Shooter", blurb: "tap to fire at targets" },
  { id: "runner", label: "Runner", blurb: "endless run, jump the obstacles" },
];

const ruleCls =
  "rounded-[4px] border border-[#1d1f23] bg-[#30343a] p-2.5 hover:border-[#4772b3]/60 transition-colors";
const labelCls = "mb-1 flex items-center gap-1.5 text-[10px] font-heading uppercase tracking-wide text-[#9aa7b8]";
const inpCls =
  "h-7 w-full rounded-[3px] border border-[#1d1f23] bg-[#25272b] px-2 text-[12px] text-[#e6e6e6] outline-none focus:border-[#4772b3]";
const selCls = `${inpCls} cursor-pointer`;
const segBtn = (on: boolean) =>
  `h-7 flex-1 rounded-[3px] text-[11px] font-medium transition-colors ${
    on ? "bg-[#4772b3] text-white" : "bg-[#25272b] text-[#a0a0a0] hover:bg-[#3a3a3a]"
  }`;

function Rule({ icon, title, children, hint }: { icon: React.ReactNode; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className={ruleCls}>
      <div className={labelCls}>
        {icon}
        {title}
        {hint && <span className="ml-auto normal-case text-[#6f7c8c]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function GameLogicEditor({ config, setConfig, onApply, onPlay }: Props) {
  const [dirty, setDirty] = useState(false);

  const apply = (patch: Partial<StudioConfig>) => {
    setConfig({ ...config, ...patch });
    setDirty(true);
  };

  const generated = useMemo(() => JSON.stringify(buildGameplay(config), null, 2), [config]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#26272b] text-[12px] text-[#d7d7d7]">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[#1d1f23] bg-[#2e3036] px-3">
        <Blocks size={13} className="text-[#8fb0e0]" />
        <span className="font-heading uppercase tracking-wide text-[#cfcfcf]">Game Logic</span>
        <span className="hidden text-[10px] text-[#7a8696] lg:inline">visual script ▸ gameplay.json</span>
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <span className="flex items-center gap-1 text-[10px] text-[#e6cd5b]">
              <Wand2 size={11} /> unsaved
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setConfig({ ...config, mode: "catch", difficulty: "medium", levels: 5, goal: 15, speed: 3.4, spawnMs: 850 });
              setDirty(false);
            }}
            className="flex h-6 items-center gap-1 rounded-[3px] border border-[#3a3a3a] px-2 text-[11px] text-[#a0a0a0] hover:bg-[#3a3a3a]"
          >
            <RotateCcw size={11} /> Reset
          </button>
          <button
            type="button"
            onClick={onPlay}
            className="flex h-6 items-center gap-1 rounded-[3px] border border-[#3a3a3a] px-2 text-[11px] text-[#a0d8a0] hover:bg-[#3a3a3a]"
          >
            <Rocket size={11} /> Play
          </button>
          <button
            type="button"
            onClick={() => {
              onApply();
              setDirty(false);
            }}
            className="flex h-6 items-center gap-1 rounded-[3px] bg-[#4772b3] px-2.5 text-[11px] font-medium text-white hover:bg-[#5683c7]"
          >
            <Save size={11} /> Apply &amp; Save
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ——— visual blocks ——— */}
        <div className="flex min-h-0 w-[58%] min-w-[280px] flex-col gap-2 overflow-y-auto p-2">
          <Rule icon={<Target size={12} className="text-[#e6cd5b]" />} title="Objective" hint="what winning means">
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button key={m.id} type="button" className={segBtn(config.mode === m.id)} title={m.blurb} onClick={() => apply({ mode: m.id })}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-[#8a97a6]">Score target</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={config.goal}
                  onChange={(e) => apply({ goal: Math.max(1, Number(e.target.value) || 1) })}
                  className={inpCls}
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-[#8a97a6]">Levels</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={config.levels}
                  onChange={(e) => apply({ levels: Math.max(1, Number(e.target.value) || 1) })}
                  className={inpCls}
                />
              </label>
            </div>
          </Rule>

          <Rule icon={<Zap size={12} className="text-[#8fb0e0]" />} title="Game speed & spawns" hint="difficulty curve">
            <label className="block">
              <span className="mb-0.5 flex justify-between text-[10px] text-[#8a97a6]">
                <span>Spawn every</span>
                <span className="tabular-nums text-[#e6cd5b]">{config.spawnMs} ms</span>
              </span>
              <input
                type="range"
                min={300}
                max={2000}
                step={50}
                value={config.spawnMs}
                onChange={(e) => apply({ spawnMs: Number(e.target.value) })}
                className="w-full accent-[#4772b3]"
              />
            </label>
            <label className="mt-2 block">
              <span className="mb-0.5 flex justify-between text-[10px] text-[#8a97a6]">
                <span>Fall / move speed</span>
                <span className="tabular-nums text-[#e6cd5b]">{config.speed.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={1}
                max={8}
                step={0.1}
                value={config.speed}
                onChange={(e) => apply({ speed: Number(e.target.value) })}
                className="w-full accent-[#4772b3]"
              />
            </label>
          </Rule>

          <Rule icon={<Swords size={12} className="text-[#e6957f]" />} title="Difficulty" hint="preset AI tuning">
            <div className="flex gap-2">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button key={d} type="button" className={segBtn(config.difficulty === d)} onClick={() => apply({ difficulty: d })}>
                  {d}
                </button>
              ))}
            </div>
          </Rule>

          <Rule icon={<Sparkles size={12} className="text-[#8ad18a]" />} title="Cast names" hint="labels in the game HUD">
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-[#8a97a6]">Player</span>
                <input value={config.names.player} onChange={(e) => apply({ names: { ...config.names, player: e.target.value } })} className={inpCls} />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-[#8a97a6]">{GOOD_LABEL[config.mode]}</span>
                <input value={config.names.good} onChange={(e) => apply({ names: { ...config.names, good: e.target.value } })} className={inpCls} />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-[#8a97a6]">{BAD_LABEL[config.mode]}</span>
                <input value={config.names.bad} onChange={(e) => apply({ names: { ...config.names, bad: e.target.value } })} className={inpCls} />
              </label>
            </div>
          </Rule>

          <Rule icon={<Settings2 size={12} className="text-[#c98ad6]" />} title="World theme" hint="colors the player sees">
            <div className="grid grid-cols-6 gap-2">
              {(
                [
                  ["bg", config.theme.bg],
                  ["player", config.theme.player],
                  ["good", config.theme.good],
                  ["bad", config.theme.bad],
                  ["accent", config.theme.accent],
                  ["text", config.theme.text],
                ] as [keyof StudioConfig["theme"], string][]
              ).map(([key, value]) => (
                <label key={key} className="block">
                  <span className="mb-0.5 block text-[10px] capitalize text-[#8a97a6]">{key}</span>
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => apply({ theme: { ...config.theme, [key]: e.target.value } })}
                    className="h-8 w-full cursor-pointer rounded-[3px] border border-[#1d1f23] bg-transparent p-0.5"
                  />
                </label>
              ))}
            </div>
          </Rule>
        </div>

        {/* ——— generated script ——— */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-[#1d1f23] bg-[#232428]">
          <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-[#1d1f23] px-3 text-[10px] font-heading uppercase tracking-wide text-[#7a8696]">
            <Check size={11} className="text-[#8ad18a]" />
            Generated gameplay.json — the engine reads this file
          </div>
          <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[10.5px] leading-relaxed text-[#9fd4a0]">
            {generated}
          </pre>
        </div>
      </div>
    </div>
  );
}