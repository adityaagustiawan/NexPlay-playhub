// DopeSheet.tsx — real keyframe channels for the selected scene object.
// One row per animated channel; clicking the ruler scrubs the timeline.
import { useRef, useState } from "react";
import { Diamond, KeyRound } from "lucide-react";

export interface DopeChannel {
  /** e.g. "Cube · Location" */
  name: string;
  frames: number[];
}

interface Props {
  frame: number;
  endFrame: number;
  channels: DopeChannel[];
  onFrameChange: (frame: number) => void;
}

const CHAN_COLOR = ["#e6cd5b", "#7fb0e6", "#8ad18a", "#e6957f", "#c98ad6", "#8fd6c4"];

export function DopeSheet({ frame, endFrame, channels, onFrameChange }: Props) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const fracOf = (f: number) => (endFrame > 0 ? Math.max(0, Math.min(1, f / endFrame)) : 0);
  const scrubTo = (clientX: number) => {
    const el = rulerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onFrameChange(Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * endFrame));
  };

  const ticks: React.ReactNode[] = [];
  for (let t = 0; t <= endFrame; t += 24)
    ticks.push(
      <div key={t} className="absolute top-0 h-full border-l border-[#3a3a3a]" style={{ left: `${fracOf(t) * 100}%` }}>
        <span className="ml-1 text-[9px] text-[#7a7a7a]">{t}</span>
      </div>,
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#282828] text-[11px] text-[#d0d0d0] select-none">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-[#1d1d1d] bg-[#303030] px-3 font-heading uppercase tracking-wide text-[#b8b8b8]">
        <KeyRound size={12} className="text-[#e6cd5b]" />
        Dope Sheet
        <span className="ml-auto text-[10px] normal-case text-[#7a7a7a]">frame {frame}</span>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-48 shrink-0 overflow-y-auto border-r border-[#1d1d1d] bg-[#2b2b2b] px-2 py-2">
          {channels.length === 0 ? (
            <p className="px-1 py-2 leading-relaxed text-[#8a8a8a]">
              No keyframes yet. Select an object in the 3D view, then press{" "}
              <kbd className="rounded border border-[#4a4a4a] px-1">I</kbd> (or use the
              Timeline's Insert button) to record Location / Rotation / Scale keys.
            </p>
          ) : (
            channels.map((ch, i) => {
              const cf = Math.round(frame);
              const active = ch.frames.includes(cf);
              return (
                <div
                  key={ch.name}
                  onClick={() => onFrameChange(ch.frames[ch.frames.length - 1] ?? 0)}
                  className={`mb-0.5 flex h-7 cursor-pointer items-center gap-2 rounded-[3px] px-2 ${
                    active ? "bg-[#4772b3]/60 text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"
                  }`}
                >
                  <Diamond
                    size={9}
                    fill={active ? "#ffffff" : CHAN_COLOR[i % CHAN_COLOR.length]}
                    stroke={CHAN_COLOR[i % CHAN_COLOR.length]}
                  />
                  <span className="truncate">{ch.name}</span>
                  <span className="ml-auto tabular-nums text-[10px] text-[#8a8a8a]">{ch.frames.length}</span>
                </div>
              );
            })
          )}
        </div>
        <div
          ref={rulerRef}
          className="relative min-h-0 flex-1 cursor-ew-resize overflow-hidden bg-[#262626]"
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
          {ticks}
          {channels.map((ch, i) => {
            const cf = Math.round(frame);
            return (
              <div key={ch.name} className="absolute inset-x-0 flex h-7 items-center" style={{ top: 12 + i * 28 }}>
                {ch.frames.map((kf) => {
                  const isNow = kf === cf;
                return (
                  <div key={kf} className="absolute -translate-x-1/2" style={{ left: `${fracOf(kf) * 100}%` }}>
                    <div
                      className={`h-2.5 w-2.5 rotate-45 rounded-[1px] ${
                        isNow
                          ? "border border-white bg-[#ffffff]"
                          : "border border-[#8a7a2a] bg-[#e6cd5b]"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          );
          })}
          {/* playhead */}
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-[#e6cd5b]"
            style={{ left: `${fracOf(frame) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}