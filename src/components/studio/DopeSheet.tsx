// DopeSheet.tsx — a placeholder DopeSheet for animations. Shows channels
// and a simple scrub line; kept intentionally lightweight for now.
import { useState } from "react";

const CHANNELS = ["Object: Location", "Object: Rotation", "Object: Scale"];

export function DopeSheet() {
  const [frame, setFrame] = useState(0);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#282828] text-[11px] text-[#d0d0d0]">
      <div className="flex h-7 shrink-0 items-center border-b border-[#1d1d1d] bg-[#303030] px-3 font-heading uppercase tracking-wide text-[#b8b8b8]">
        Dope Sheet
      </div>
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <div className="w-40 shrink-0 border-r border-[#1d1d1d] bg-[#2b2b2b] px-2 py-2">
          {CHANNELS.map((c) => (
            <div key={c} className="flex h-6 items-center rounded-[3px] px-2 text-[#b0b0b0] hover:bg-[#3a3a3a]">
              {c}
            </div>
          ))}
        </div>
        <div className="relative flex-1 overflow-x-auto">
          <div className="h-full w-[2000px] bg-[repeating-linear-gradient(to_right,transparent,transparent_48px,#3a3a3a_48px,#3a3a3a_49px)]" />
          <div
            className="absolute top-0 h-full border-l border-[#7bd88f]"
            style={{ left: `${(frame / 120) * 100}%` }}
            onClick={(e) => setFrame(Math.round((e.nativeEvent.offsetX / (e.currentTarget.parentElement?.clientWidth ?? 1)) * 120))}
          />
        </div>
      </div>
    </div>
  );
}