// ConsolePanel.tsx — a simple Scripting/Log console, ported conceptually
// from Blender's System Console / Text Editor output area.
import { useState } from "react";

export function ConsolePanel() {
  const [lines] = useState<string[]>(["NexPlay Studio console ready."]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#1d1d1d] text-[11px] font-mono text-[#c0c0c0]">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-black bg-[#303030] px-3 font-heading text-[11px] uppercase tracking-wide text-[#b8b8b8]">
        Console
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        {lines.map((l, i) => (
          <div key={`${i}-${l}`} className="truncate">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}