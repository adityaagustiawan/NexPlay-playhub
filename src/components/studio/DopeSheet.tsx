// DopeSheet.tsx — a placeholder DopeSheet for animations. Shows channels
// and a simple scrub line; kept intentionally lightweight for now.
import { useState } from "react";

const CHANNELS = ["Object: Location", "Object: Rotation", "Object: Scale"];

export function DopeSheet() {
  const [frame, setFrame] = useState(0);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#282828] text-[11px] text-[#d0d0d0] select-none">
      <div className="flex h-7 shrink-0 items-center border-b border-[#1d1d1d] bg-[#303030] px-3 font-heading uppercase tracking-wide text-[#b8b8b8]">
        Dope Sheet
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-44 shrink-0 border-r border-[#1d1d1d] bg-[#2b2b2b] px-2 py-2">
          {CHANNELS.map((c) => (
            <div key={c} className="flex h-6 items-center rounded-[3px] px-2 text-[#b0b0b0] hover:bg-[#3a3a3a]">
              {c}
            </div>
          ))}
        </div>
        <div
          className="relative flex-1 overflow-x-auto bg-[repeating-linear-gradient(to_right,transparent,transparent_50px,#3a3a3a_50px,#3a3a3a_51px)]"
          onClick={(e) => {
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            setFrame(Math.max(0, Math.min(250, Math.round((x / rect.width) * 250))));
          }}
        >
          <div
            className="absolute top-0 h-full border-l border-[#7bd88f]"
            style={{ left: `${(frame / 250) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}