// ConsolePanel.tsx — a live engine console for the Scripting workspace. It
// subscribes to the real game engine's event bus, so every Score / LevelChange /
// AutoSave / GameOver / Ready emitted while a game runs in the studio lands here.
import { useEffect, useRef, useState } from "react";
import { Terminal, Trash2 } from "lucide-react";
import { EngineEvents, eventBus } from "@/engine/eventBus";

interface LogLine {
  id: number;
  time: string;
  level: "info" | "event" | "error" | "success";
  text: string;
}

let nextId = 1;

function toLine(level: LogLine["level"], text: string): LogLine {
  return {
    id: nextId++,
    time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
    level,
    text,
  };
}

const PALETTE: Record<LogLine["level"], string> = {
  info: "#9aa7b8",
  event: "#8fb0e0",
  error: "#e6957f",
  success: "#8ad18a",
};

export function ConsolePanel() {
  const [lines, setLines] = useState<LogLine[]>([
    {
      id: nextId++,
      time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      level: "info",
      text: "engine console ready — press Play in the viewport to stream events",
    },
  ]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const push = (level: LogLine["level"]) => (data?: unknown) => {
      setLines((ls) => {
        const msg = data === undefined ? "" : typeof data === "string" ? data : JSON.stringify(data);
        return [...ls.slice(-250), toLine(level, msg)];
      });
    };
    setLines((ls) => [...ls.slice(-250), toLine("info", "game script compiled — gameplay.json loaded")]);
    const offs = [
      eventBus.on(EngineEvents.Ready, push("success")),
      eventBus.on(EngineEvents.Score, (d) =>
        setLines((ls) => [...ls.slice(-250), toLine("event", `score → ${JSON.stringify(d)}`)]),
      ),
      eventBus.on(EngineEvents.LevelChange, (d) =>
        setLines((ls) => [...ls.slice(-250), toLine("event", `level change → ${JSON.stringify(d)}`)]),
      ),
      eventBus.on(EngineEvents.AutoSave, (d) =>
        setLines((ls) => [...ls.slice(-250), toLine("info", `autosave ${JSON.stringify(d)}`)]),
      ),
      eventBus.on(EngineEvents.GameOver, (d) =>
        setLines((ls) => [...ls.slice(-250), toLine("error", `game over → ${JSON.stringify(d)}`)]),
      ),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#1b1d21] text-[11px] text-[#c9c9c9]">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-[#1d1f23] bg-[#2e3036] px-3">
        <Terminal size={12} className="text-[#8ad18a]" />
        <span className="font-heading uppercase tracking-wide text-[#b8b8b8]">Engine Console</span>
        <button
          type="button"
          onClick={() => setLines([])}
          className="ml-auto flex h-5 items-center gap-1 rounded-[3px] px-1.5 text-[10px] text-[#7a8696] hover:bg-[#3a3a3a] hover:text-[#d0d0d0]"
        >
          <Trash2 size={10} /> clear
        </button>
      </div>
      <div ref={bodyRef} className="min-h-0 flex-1 space-y-px overflow-y-auto p-2 font-mono">
        {lines.length === 0 && <p className="text-[#5a6570]">(empty)</p>}
        {lines.map((l) => (
          <div key={l.id} className="flex gap-2 whitespace-pre-wrap break-all">
            <span className="shrink-0 text-[#5a6570]">{l.time}</span>
            <span className="shrink-0 text-[#4772b3]">▸</span>
            <span style={{ color: PALETTE[l.level] }}>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}