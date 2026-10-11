// Timeline.tsx — a minimal Blender-like timeline. Ranges over frames,
// shows a current frame indicator and transport controls. Designed to be
// extended with keyframes for animations in future iterations.
import { Pause, Play, Rewind } from "lucide-react";
import { useState } from "react";

interface Props {
  fps?: number;
  startFrame?: number;
  endFrame?: number;
  onFrameChange?: (frame: number) => void;
}

const btnCls = (on: boolean) =>
  `flex h-6 w-6 items-center justify-center rounded-[3px] ${
    on ? "bg-[#4772b3] text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"
  }`;

export function Timeline({ fps = 24, startFrame = 0, endFrame = 120, onFrameChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);

  const update = (f: number) => {
    const clamped = Math.max(startFrame, Math.min(endFrame, Math.round(f)));
    setFrame(clamped);
    onFrameChange?.(clamped);
  };

  const duration = Math.max(0, endFrame - startFrame);
  const pct = duration === 0 ? 0 : ((frame - startFrame) / duration) * 100;

  return (
    <div className="flex h-7 shrink-0 items-center gap-2 border-t border-black bg-[#303030] px-2 text-[11px] text-[#d0d0d0] select-none">
      <div className="flex items-center gap-0.5">
        <button type="button" title="Rewind" onClick={() => update(startFrame)} className={btnCls(false)}>
          <Rewind className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((p) => !p)}
          className={btnCls(playing)}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="tabular-nums text-[#8f8f8f]">{frame}</span>
        <span className="text-[#8f8f8f]">{fps} FPS</span>
      </div>
      <div className="relative mx-2 flex-1">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[#4a4a4a]" />
        <div className="relative h-5">
          <div
            className="absolute top-0 h-full border-l border-[#4772b3] shadow-[0_0_0_1px_rgba(71,114,179,0.4)_inset]"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
      <span className="tabular-nums text-[#8f8f8f]">
        {startFrame}–{endFrame}
      </span>
    </div>
  );
}