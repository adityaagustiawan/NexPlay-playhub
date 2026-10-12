// Timeline.tsx — a Blender-like timeline with transport controls and keyframe
// scrubbing. Fully controlled: frame/playing live in Studio so the playback
// loop, dope sheet and viewport all stay in sync.
import { Pause, Play, Rewind, Diamond, StepForward } from "lucide-react";
import { useRef, useState } from "react";

type Channel = "pos" | "rot" | "scl";

interface Props {
  fps?: number;
  frame: number;
  playing: boolean;
  autoKey?: boolean;
  endFrame: number;
  /** Frame numbers that carry any keyframe, for the key diamonds. */
  keyFrames?: number[];
  onFrameChange: (frame: number) => void;
  onTogglePlay: () => void;
  onToggleAutoKey?: () => void;
  onInsertKeyframe: (channel: Channel) => void;
}

const btnCls = (on: boolean) =>
  `flex h-6 w-6 items-center justify-center rounded-[3px] ${
    on ? "bg-[#4772b3] text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"
  }`;

const fmt = (f: number) => `${Math.floor(f / 60)}:${String(Math.floor(f % 60)).padStart(2, "0")}`;

export function Timeline({
  fps = 24,
  frame,
  playing,
  autoKey = true,
  endFrame = 120,
  keyFrames = [],
  onFrameChange,
  onTogglePlay,
  onToggleAutoKey,
  onInsertKeyframe,
}: Props) {
  const [insertOpen, setInsertOpen] = useState(false);
  const scrubRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const frameToFrac = (f: number) => (endFrame > 0 ? Math.max(0, Math.min(1, f / endFrame)) : 0);

  const scrubTo = (clientX: number) => {
    const el = scrubRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    onFrameChange(Math.round(Math.max(0, Math.min(1, frac)) * endFrame));
  };

  const ticks: React.ReactNode[] = [];
  const step = endFrame > 240 ? 24 : 12;
  for (let t = 0; t <= endFrame; t += step) {
    ticks.push(
      <div key={t} className="absolute top-1 border-l border-[#4a4a4a]" style={{ left: `${frameToFrac(t) * 100}%` }}>
        <span className="ml-1 text-[9px] text-[#8a8a8a]">{t}</span>
      </div>,
    );
  }

  const keySet = new Set(keyFrames);

  return (
    <div className="flex min-h-0 flex-1 select-none flex-col bg-[#282828] text-[11px] text-[#d0d0d0]">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-[#1d1d1d] bg-[#303030] px-2">
        <button
          type="button"
          className={btnCls(false)}
          title="Go to start"
          onClick={() => onFrameChange(0)}
        >
          <Rewind size={13} />
        </button>
        <button
          type="button"
          className={btnCls(playing)}
          title="Play / pause (Alt+A)"
          onClick={onTogglePlay}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          type="button"
          className={btnCls(false)}
          title="Step one frame forward"
          onClick={() => onFrameChange(Math.round(frame) + 1)}
        >
          <StepForward size={13} />
        </button>

        <span className="ml-1 font-heading tabular-nums text-[#e6cd5b]">
          {Math.round(frame)}
          <span className="text-[#8a8a8a]"> / {endFrame}</span>
        </span>
        <span className="ml-1 text-[10px] tabular-nums text-[#7a7a7a]">
          {fmt(frame / fps)}s @ {fps}fps
        </span>

        <div className="relative ml-auto">
          <button
            type="button"
            className="flex h-6 items-center gap-1 rounded-[3px] border border-[#e6cd5b]/40 px-2 text-[#e6cd5b] hover:bg-[#3a3a3a]"
            title="Insert keyframe (I) — Location/Rotation/Scale at current frame"
            onClick={() => setInsertOpen((v) => !v)}
          >
            <Diamond size={11} fill="currentColor" /> Insert
          </button>
          {insertOpen && (
            <div className="absolute right-0 top-7 z-20 w-44 rounded-[4px] border border-[#1d1d1d] bg-[#383838] py-1 shadow-xl">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#4772b3]"
                onClick={() => {
                  onInsertKeyframe("all");
                  setInsertOpen(false);
                }}
              >
                <Diamond size={10} fill="#e6cd5b" stroke="#e6cd5b" /> All (Loc/Rot/Sca)
              </button>
              {(
                [
                  ["pos", "Location"],
                  ["rot", "Rotation"],
                  ["scl", "Scale"],
                ] as [Channel, string][]
              ).map(([ch, label]) => (
                <button
                  key={ch}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#4772b3]"
                  onClick={() => {
                    onInsertKeyframe(ch);
                    setInsertOpen(false);
                  }}
                >
                  <Diamond size={10} fill="#e6cd5b" stroke="#e6cd5b" /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrubRef}
        className="relative min-h-0 flex-1 cursor-ew-resize overflow-hidden"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setScrubbing(true);
          scrubTo(e.clientX);
        }}
        onPointerMove={(e) => scrubbing && scrubTo(e.clientX)}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setScrubbing(false);
        }}
      >
        {/* beat ticks */}
        {ticks}
        {/* keyframes */}
        {keySet.size > 0 &&
          [...keySet].sort((a, b) => a - b).map((kf) => (
            <div
              key={kf}
              className="absolute top-1 z-10 -translate-x-1/2"
              style={{ left: `${frameToFrac(kf) * 100}%` }}
              title={`Keyframe ${kf}`}
            >
              <div className="h-2 w-2 rotate-45 rounded-[1px] border border-[#8a7a2a] bg-[#e6cd5b]" />
            </div>
          ))}
        {/* playhead */}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-[#e6cd5b]" style={{ left: `${frameToFrac(frame) * 100}%` }} />
        <div className="absolute left-0 top-0 h-0 w-full" style={{ borderTop: "1px solid #1d1d1d" }} />
      </div>

      <div className="flex h-6 shrink-0 items-center gap-3 border-t border-[#1d1d1d] bg-[#2e2e2e] px-2 text-[10px] text-[#7a7a7a]">
        <span>
          <kbd className="rounded border border-[#4a4a4a] px-1">Alt+A</kbd> play
        </span>
        <span>
          <kbd className="rounded border border-[#4a4a4a] px-1">I</kbd> insert keyframe
        </span>
        <span className="ml-auto">
          {keySet.size > 0 ? `${keySet.size} keyf${keySet.size === 1 ? "rame" : "rames"}` : "no keys yet — move the selected object and press I"}
        </span>
      </div>
    </div>
  );
}