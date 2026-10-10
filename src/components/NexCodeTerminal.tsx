// NexCodeTerminal.tsx — the in-browser "NexCode" terminal.
// Renders the live build log streamed from /api/generate-game: a real-time view
// of the constrained AI constructing a game. Green = ok, amber = warning,
// red = blocked/error.
import { useEffect, useRef } from "react";
import { Terminal, ShieldAlert } from "lucide-react";
import type { NexCodeLine } from "@/hooks/useNexCode";

const LEVEL_CLASS: Record<string, string> = {
  sys: "text-primary",
  dim: "text-muted-foreground/60",
  prompt: "text-foreground",
  info: "text-muted-foreground",
  ok: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

interface Props {
  lines: NexCodeLine[];
  running: boolean;
  className?: string;
}

export function NexCodeTerminal({ lines, running, className = "" }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines, running]);

  return (
    <div className={`bg-[#0a0e1a] border border-border rounded-2xl overflow-hidden ${className}`}>
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-black/40">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <div className="ml-2 flex items-center gap-2 text-white/80">
          <Terminal className="h-3.5 w-3.5" />
          <span className="font-heading text-xs font-semibold tracking-wide">nexcode</span>
          <span className="font-body text-[10px] text-white/40">games-only AI builder</span>
        </div>
        <span className="ml-auto flex items-center gap-1.5 font-body text-[10px] text-emerald-400/90">
          <ShieldAlert className="h-3 w-3" />
          sandboxed
        </span>
      </div>

      <div
        ref={bodyRef}
        className="px-4 py-3 h-64 overflow-y-auto font-mono text-[12.5px] leading-relaxed"
      >
        {lines.length === 0 && !running && (
          <p className="text-white/35">
            NexCode is idle. Describe a game and press <span className="text-white/60">Generate</span>.
          </p>
        )}
        {lines.map((line) => (
          <div key={line.id} className="flex gap-2">
            <span className="text-white/25 select-none">›</span>
            <span className={`whitespace-pre-wrap break-words ${LEVEL_CLASS[line.level] ?? "text-white/80"}`}>
              {line.text}
            </span>
          </div>
        ))}
        {running && (
          <div className="flex gap-2 items-center text-white/50">
            <span className="text-white/25 select-none">›</span>
            <span className="inline-block w-2 h-4 bg-emerald-400/80 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
