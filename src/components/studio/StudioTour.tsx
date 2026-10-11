// StudioTour.tsx — the animated "how to use" walkthrough (a video-like sequence
// of short clips) shown the first time a user opens the studio. Each step plays
// a small animated scene on a loop and the tour auto-advances; it can also be
// steered with the dots / prev / next / pause controls. Dismissing it marks the
// account as onboarded so it is not shown again.
import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  MousePointer2,
  Pause,
  Play,
  Save,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

const STEP_MS = 3200;

interface Step {
  title: string;
  caption: string;
  scene: ReactNode;
}

/** A reveal-typing line: characters appear one by one with a blinking caret. */
function TypeLine({ text, speed = 45, className }: { text: string; speed?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return (
    <span className={`inline-flex max-w-full items-center ${className ?? ""}`}>
      <span className="truncate">{text.slice(0, n)}</span>
      <span className="caret-blink ml-0.5 inline-block h-3.5 w-[1.5px] shrink-0 bg-[#7bd88f]" />
    </span>
  );
}

/** The "viewport" stage every scene is drawn on. */
function Stage({ children, grid = true }: { children: ReactNode; grid?: boolean }) {
  return (
    <div className="relative flex h-[264px] items-center justify-center overflow-hidden rounded-[6px] border border-[#3a3a3a] bg-[#1b1b1b] px-6">
      {grid ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(#252525 1px, transparent 1px), linear-gradient(90deg,#252525 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      ) : null}
      <div className="relative w-full max-w-[520px]">{children}</div>
    </div>
  );
}

function SceneTitle() {
  return (
    <Stage>
      <div className="rounded-[6px] border border-[#3a3a3a] bg-[#2b2b2b] p-3">
        <div className="mb-1 text-[9px] uppercase tracking-wide text-[#8f8f8f]">Properties ▸ Scene · Title</div>
        <div className="tour-pulse rounded-[4px] border border-[#4772b3] bg-[#1d1d1d] px-2 py-1.5 text-[12px] text-[#eaeaea]">
          <TypeLine text="Neon Runner" />
        </div>
        <div className="mt-2 text-[9px] text-[#8f8f8f]">This becomes your game's name in the library.</div>
      </div>
    </Stage>
  );
}

function SceneDimension() {
  return (
    <Stage>
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 flex-col gap-1 rounded-[4px] bg-[#2b2b2b] p-1">
          <span className="rounded-[3px] px-3 py-1 text-center text-[11px] text-[#b0b0b0]">2D</span>
          <span className="tour-pulse rounded-[3px] bg-[#4772b3] px-3 py-1 text-center text-[11px] text-white">3D</span>
        </div>
        <div className="relative h-[150px] flex-1 overflow-hidden rounded-[4px] bg-gradient-to-b from-[#1d2430] to-[#141414]">
          <div className="tour-spin absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-[#6f97d6] bg-gradient-to-br from-[#4772b3] to-[#2b3f63] shadow-[0_0_30px_rgba(71,114,179,0.5)]" />
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2 py-0.5 text-[9px] text-[#c8c8c8]">
            the viewport adapts to 2D or 3D
          </span>
        </div>
      </div>
    </Stage>
  );
}

function SceneMode() {
  return (
    <Stage>
      <div className="text-center">
        <div className="mb-3 text-[9px] uppercase tracking-wide text-[#8f8f8f]">Gameplay mode</div>
        <div className="flex justify-center gap-2">
          {["Catch", "Shooter", "Runner"].map((m) => (
            <span
              key={m}
              className={`rounded-[4px] px-4 py-2 text-[12px] ${
                m === "Runner"
                  ? "tour-pulse bg-[#4772b3] font-medium text-white"
                  : "border border-[#3a3a3a] bg-[#262626] text-[#9a9a9a]"
              }`}
            >
              {m}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-[#8f8f8f]">Catch · Shooter · Runner — this defines the core loop.</p>
      </div>
    </Stage>
  );
}

function SceneTuning() {
  return (
    <Stage>
      <div className="rounded-[6px] border border-[#3a3a3a] bg-[#2b2b2b] p-3">
        <div className="flex items-center justify-between text-[10px] text-[#c8c8c8]">
          <span>Difficulty</span>
          <span className="text-[#e8e8e8]">Hard</span>
        </div>
        <div className="mt-1.5 flex gap-1">
          {["Easy", "Medium", "Hard"].map((d) => (
            <span
              key={d}
              className={`flex-1 rounded-[3px] py-1 text-center text-[10px] ${
                d === "Hard" ? "bg-[#4772b3] text-white" : "bg-[#3a3a3a] text-[#b0b0b0]"
              }`}
            >
              {d}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-[10px] text-[#c8c8c8]">
          <span>Goal</span>
          <span className="font-mono text-[#e8e8e8]">25</span>
        </div>
        <div className="relative mt-2 h-1.5 rounded-full bg-[#1d1d1d]">
          <div className="tour-thumb absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-white/40 bg-[#4772b3]" />
        </div>

        <div className="mt-4 flex items-center justify-between text-[10px] text-[#c8c8c8]">
          <span>Speed</span>
          <span className="font-mono text-[#e8e8e8]">5.2</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#1d1d1d]">
          <div className="h-full w-[62%] rounded-full bg-[#5a85c6]" />
        </div>
      </div>
    </Stage>
  );
}

function SceneMuse() {
  const chips = [
    "Title → “Spike Run”",
    "Viewport → 3D",
    "Mode → runner",
    "Objects: Spikes, Gems",
    "Difficulty → hard",
  ];
  return (
    <Stage>
      <div className="rounded-[6px] border border-[#3a3a3a] bg-[#2b2b2b] p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] text-[#7bd88f]">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Muse · Build mode
        </div>
        <div className="rounded-[4px] border border-[#4772b3] bg-[#1d1d1d] px-2 py-1.5 text-[12px] text-[#eaeaea]">
          <TypeLine text="a runner where you dodge spikes and collect gems" speed={26} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((t, i) => (
            <span
              key={t}
              className="game-pop rounded-full border border-[#2f5a3a] bg-[#1d2a1d] px-2 py-0.5 text-[10px] text-[#c7e6c7]"
              style={{ animationDelay: `${700 + i * 280}ms`, animationFillMode: "both", opacity: 0 }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Stage>
  );
}

function SceneSave() {
  return (
    <Stage>
      <div className="relative grid grid-cols-2 gap-3 pr-6">
        <div className="rounded-[6px] border border-[#3a3a3a] bg-[#2b2b2b] p-3">
          <div className="flex items-center gap-2 text-[11px] text-[#e0e0e0]">
            <Save className="h-3.5 w-3.5 text-[#5a85c6]" /> Save draft
          </div>
          <p className="mt-1 text-[9px] leading-snug text-[#8f8f8f]">
            Private. Builds with an asset-import animation.
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1d1d1d]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#4772b3] to-[#7bd88f]" style={{ animation: "intro-bar 1.6s linear infinite" }} />
          </div>
        </div>
        <div className="tour-pulse rounded-[6px] border border-[#4772b3] bg-[#2b2b2b] p-3">
          <div className="flex items-center gap-2 text-[11px] text-[#e0e0e0]">
            <Upload className="h-3.5 w-3.5 text-[#5a85c6]" /> Publish
          </div>
          <p className="mt-1 text-[9px] leading-snug text-[#8f8f8f]">Submits for review — players can play it.</p>
        </div>
        <MousePointer2
          className="absolute -bottom-3 left-1/2 h-5 w-5 -translate-x-1/2 text-white drop-shadow"
          style={{ animation: "tour-cursor 2.4s ease-in-out infinite alternate" }}
        />
      </div>
    </Stage>
  );
}

function ScenePlay() {
  const dots = [
    { left: "18%", top: "70%", delay: "0s", color: "#4772b3" },
    { left: "42%", top: "78%", delay: "0.5s", color: "#7bd88f" },
    { left: "68%", top: "64%", delay: "1s", color: "#e0b341" },
    { left: "84%", top: "80%", delay: "1.4s", color: "#c76f9a" },
  ];
  return (
    <Stage grid={false}>
      <div className="relative h-[190px] w-full overflow-hidden rounded-[6px] border border-[#3a3a3a] bg-gradient-to-b from-[#141922] to-[#0e0e0e]">
        {dots.map((d) => (
          <span
            key={d.left}
            className="tour-drift absolute h-3 w-3 rounded-full"
            style={{ left: d.left, top: d.top, background: d.color, animationDelay: d.delay, boxShadow: `0 0 14px ${d.color}` }}
          />
        ))}
        <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 font-mono text-[10px] text-[#7bd88f]">
          score 3
        </span>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#4772b3] px-3 py-1 text-[11px] text-white shadow-lg">
          <Play className="h-3.5 w-3.5" fill="currentColor" /> Play
        </div>
      </div>
    </Stage>
  );
}

const STEPS: Step[] = [
  { title: "Name your game", caption: "Type a title in Properties ▸ Scene. It becomes your game's name.", scene: <SceneTitle /> },
  { title: "Pick 2D or 3D", caption: "The viewport adapts — a flat 2D canvas or a full 3D world.", scene: <SceneDimension /> },
  { title: "Choose a mode", caption: "Catch, Shooter or Runner defines the core gameplay loop.", scene: <SceneMode /> },
  { title: "Tune the challenge", caption: "Difficulty, goal, speed and spawn rate shape the game.", scene: <SceneTuning /> },
  { title: "Ask Muse to build it", caption: "Describe the game — Muse creates the objects and settings for you.", scene: <SceneMuse /> },
  { title: "Save a draft or Publish", caption: "Save builds a private draft. Publish submits it for review.", scene: <SceneSave /> },
  { title: "Play & share", caption: "Test it here, then share the link from NexConsole.", scene: <ScenePlay /> },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function StudioTour({ open, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  // Auto-advance while playing; stop once the last step is reached.
  useEffect(() => {
    if (!open || !playing) return;
    if (index >= STEPS.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setIndex((i) => Math.min(STEPS.length - 1, i + 1)), STEP_MS);
    return () => window.clearTimeout(t);
  }, [open, playing, index]);

  // Restart from the top each time the tour is opened.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setPlaying(true);
    }
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const step = STEPS[index];
  const last = index >= STEPS.length - 1;
  const progress = ((index + 1) / STEPS.length) * 100;

  return (
    <div
      data-testid="studio-tour"
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/65 p-4 animate-[intro-in_0.25s_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-[760px] max-w-full flex-col overflow-hidden rounded-xl border border-[#3d3d3d] bg-[#242424] font-body text-[11px] text-[#d6d6d6] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[#3d3d3d] bg-[#2b2b2b] px-4 py-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#4772b3]">
            <Play className="h-3 w-3 text-white" fill="currentColor" />
          </span>
          <span className="font-heading text-[12px] font-semibold text-[#f0f0f0]">
            How to use <span className="text-[#5a85c6]">NexPlay Studio</span>
          </span>
          <span className="ml-2 rounded-full border border-[#3d3d3d] px-2 py-0.5 text-[9px] text-[#8f8f8f]">
            first-time tour
          </span>
          <button
            type="button"
            data-testid="studio-tour-done"
            aria-label="Close tour"
            onClick={onClose}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-[3px] text-[#9a9a9a] hover:bg-[#3a3a3a] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stage */}
        <div className="overflow-y-auto p-4">
          <div key={index} className="animate-[intro-in_0.3s_ease-out]">
            {step.scene}
          </div>

          <div className="mt-3 min-h-[52px]">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4772b3] text-[10px] font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="font-heading text-[13px] font-semibold text-[#f0f0f0]">{step.title}</h3>
            </div>
            <p className="mt-1 pl-7 text-[11px] text-[#a8a8a8]">{step.caption}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#3d3d3d] bg-[#2b2b2b] px-4 py-2.5">
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-[#1d1d1d]">
            <div className="h-full rounded-full bg-[#4772b3] transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  onClick={() => {
                    setIndex(i);
                    setPlaying(false);
                  }}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-[#4772b3]" : "w-1.5 bg-[#4a4a4a] hover:bg-[#6a6a6a]"}`}
                />
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-[#3d3d3d] text-[#c8c8c8] hover:bg-[#3a3a3a] disabled:opacity-40"
                aria-label="Previous step"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-[#3d3d3d] text-[#c8c8c8] hover:bg-[#3a3a3a]"
                aria-label={playing ? "Pause tour" : "Play tour"}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              {last ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 items-center gap-1.5 rounded-[3px] bg-[#4772b3] px-3 text-[11px] text-white hover:bg-[#5a85c6]"
                >
                  <Check className="h-3.5 w-3.5" /> Start creating
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                  className="flex h-7 items-center gap-1.5 rounded-[3px] bg-[#4772b3] px-3 text-[11px] text-white hover:bg-[#5a85c6]"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-[#7a7a7a]">
            <Gamepad2 className="h-3 w-3" />
            You can replay this any time from the <span className="text-[#a8a8a8]">Help</span> menu.
          </div>
        </div>
      </div>
    </div>
  );
}
