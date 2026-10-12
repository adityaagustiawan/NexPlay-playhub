// GameView.tsx — Unity-style Game view for the NexStudio viewport.
//
// Running the game ("Play mode") replaces the 3D scene view with the live game
// canvas, the same way Unity's Game view hides the scene gizmos while you
// press Play. A Unity-style transport bar floats at the top centre:
//
//   ▶ Play ▸ Pause ▣ Restart ⏹ Stop | ⛶ Maximize-on-Play
//
// Esc / the Stop button returns to the editor scene. Ctrl+P toggles
// play/pause (handled by Studio). While paused the last frame is frozen with a
// dim overlay; while playing the Studio keymap goes quiet so game keys win.
import { useEffect, useRef, useState } from "react";
import { Gamepad2, Maximize2, Minimize2, Pause, Play, RotateCcw, Square } from "lucide-react";
import { mountGame, type GameInstance } from "@/engine/runtime";
import type { GamePackage } from "@/engine/gameLoader";

export type GameStatus = "stopped" | "playing" | "paused";

interface GameViewProps {
  pkg: GamePackage;
  title?: string;
  status: GameStatus;
  onChange: (s: GameStatus) => void;
  maximized: boolean;
  onToggleMaximized: () => void;
}

const transportBtn =
  "flex h-6 w-6 items-center justify-center rounded-[3px] text-[#d6d6d6] hover:bg-[#4772b3] hover:text-white transition-colors";

export function GameView({ pkg, title, status, onChange, maximized, onToggleMaximized }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instRef = useRef<GameInstance | null>(null);
  const pkgRef = useRef(pkg);
  const [runId, setRunId] = useState(0);

  // Keep the latest package for the next remount — a run keeps the config it
  // started with, like Unity's enter-play-mode snapshot.
  useEffect(() => {
    pkgRef.current = pkg;
  }, [pkg]);

  // Mount on first Play, pause/resume on status change, destroy on Stop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (status === "stopped") {
      instRef.current?.destroy();
      instRef.current = null;
      return;
    }
    if (!instRef.current) {
      try {
        instRef.current = mountGame(canvas, pkgRef.current, "studioplay");
      } catch {
        instRef.current = null;
      }
    }
    instRef.current?.setPaused(status === "paused");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, runId]);

  useEffect(
    () => () => {
      instRef.current?.destroy();
      instRef.current = null;
    },
    [],
  );

  /** Unity's restart: tear down and rebuild the same run. */
  const restart = () => {
    instRef.current?.destroy();
    instRef.current = null;
    setRunId((r) => r + 1);
    if (status !== "playing") onChange("playing");
  };

  return (
    <div
      className={`z-20 flex flex-col bg-black ${maximized ? "fixed inset-0 z-50" : "absolute inset-0"}`}
      data-testid="game-view"
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" />

      {/* Unity-style transport (top centre) */}
      <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-0.5 rounded-[4px] bg-[#3a3a3a]/95 p-1 shadow-lg">
        {status === "playing" ? (
          <button type="button" title="Pause (Ctrl+P)" onClick={() => onChange("paused")} className={transportBtn}>
            <Pause className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button type="button" title="Resume (Ctrl+P)" onClick={() => onChange("playing")} className={transportBtn}>
            <Play className="h-3.5 w-3.5" fill="currentColor" />
          </button>
        )}
        <button type="button" title="Restart" onClick={restart} className={transportBtn}>
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Stop (Esc)" onClick={() => onChange("stopped")} className={transportBtn}>
          <Square className="h-3.5 w-3.5" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-[#4a4a4a]" />
        <button
          type="button"
          title={maximized ? "Restore viewport" : "Maximize on Play"}
          onClick={onToggleMaximized}
          className={transportBtn}
        >
          {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Game frame pill (top right) */}
      <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-[3px] bg-[#3a3a3a]/95 px-2 py-1 text-[10px] text-[#b0b0b0]">
        <Gamepad2 className="h-3 w-3" />
        <span className="max-w-[220px] truncate">{title || "Untitled"}</span>
        <span className="text-[#6f6f6f]">· 16:9 · Fit</span>
      </div>

      {/* Paused overlay */}
      {status === "paused" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <span className="rounded-[3px] bg-[#303030] px-3 py-1.5 font-body text-[11px] text-[#d6d6d6]">
            Paused — Ctrl+P to resume
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2 z-10 font-body text-[10px] text-[#8f8f8f]">
        ← → / WASD move · Space shoot &amp; jump · Esc stop · Ctrl+P pause
      </div>
    </div>
  );
}