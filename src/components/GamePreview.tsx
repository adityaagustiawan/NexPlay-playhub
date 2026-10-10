// GamePreview.tsx — mounts a freshly generated game inline so the player can
// play it immediately after NexCode finishes. It also acts as the client-side
// "is it displayed?" check: if mounting throws we report the failure.
import { useEffect, useRef, useState } from "react";
import { Gamepad2, RotateCcw, Maximize2 } from "lucide-react";
import { mountGame, type GameInstance } from "@/engine/runtime";
import type { GamePackage } from "@/engine/gameLoader";
import { Button } from "@/components/ui/button";

interface Props {
  pkg: GamePackage;
  title: string;
  onRendered?: () => void;
  onError?: (message: string) => void;
  onOpenFull?: () => void;
}

export function GamePreview({ pkg, title, onRendered, onError, onOpenFull }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let instance: GameInstance | null = null;
    try {
      instance = mountGame(canvas, pkg, "preview");
      onRendered?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
    return () => instance?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg, nonce]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
            <Gamepad2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-sm font-bold text-foreground truncate">
              Now playing: {title}
            </p>
            <p className="font-body text-xs text-muted-foreground">
              Built by NexCode · verified &amp; playable
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setNonce((n) => n + 1)}>
            <RotateCcw className="h-4 w-4 mr-1" /> Replay
          </Button>
          {onOpenFull && (
            <Button size="sm" onClick={onOpenFull}>
              <Maximize2 className="h-4 w-4 mr-1" /> Full player
            </Button>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-[420px] block rounded-xl bg-black border border-border touch-none select-none"
      />

      <p className="font-body text-xs text-muted-foreground">
        Controls: <span className="text-foreground">← →</span> / WASD to move ·{" "}
        <span className="text-foreground">Space</span> to shoot / jump · or drag / tap.
      </p>
    </div>
  );
}
