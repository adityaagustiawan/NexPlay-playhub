// Play.tsx — Load a game by gameKey, mount it on canvas, autosave + submitScore.
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { loadGamePackage } from "@/engine/gameLoader";
import { mountGame, GameInstance } from "@/engine/runtime";
import { eventBus, EngineEvents } from "@/engine/eventBus";
import { submitScore } from "@/engine/submitScore";
import {
  startAutosave,
  loadGameState,
  setupConnectivityHandlers,
} from "@/lib/saveGame";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Gamepad2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Play = () => {
  const { gameKey } = useParams<{ gameKey: string }>();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameInstance | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameTitle, setGameTitle] = useState<string>("");
  const [gameId, setGameId] = useState<string>("");
  const [liveNonce, setLiveNonce] = useState(0);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const loadedVersionRef = useRef<number>(-1);

  useEffect(() => {
    if (!gameKey || !canvasRef.current) return;

    let destroyed = false;
    let stopAutosave: (() => void) | null = null;
    let stopConnectivity: (() => void) | null = null;

    const init = async () => {
      try {
        // 1. Load game package
        const pkg = await loadGamePackage(gameKey);
        if (destroyed) return;

        setGameTitle(pkg.title ?? gameKey);
        setLoading(false);

        // 2. Get game ID for score submission
        const { data: gameRecord } = await supabase
          .from("games")
          .select("id")
          .eq("game_key", gameKey)
          .maybeSingle();

        if (gameRecord) {
          setGameId(gameRecord.id);
        }

        // 3. Resume from saved state
        const playerId = user?.id ?? "anon";
        const savedState = await loadGameState(gameKey, playerId);
        if (destroyed) return;

        // 4. Mount game
        const instance = mountGame(canvasRef.current!, pkg, playerId);
        if (destroyed) {
          instance.destroy();
          return;
        }

        gameRef.current = instance;

        // Restore saved state if available
        if (savedState) {
          instance.submitScore((savedState.score as number) ?? 0);
        }

        // 5. Start autosave
        stopAutosave = startAutosave(gameKey, playerId, () => {
          const state = gameRef.current?.getState();
          return state ? { score: state.score, level: state.level } : {};
        });

        // 6. Connectivity handlers
        stopConnectivity = setupConnectivityHandlers(gameKey, playerId, () => {
          const state = gameRef.current?.getState();
          return state ? { score: state.score, level: state.level } : {};
        });

        // 7. Listen for game over -> submit score
        const offGameOver = eventBus.on(EngineEvents.GameOver, () => {
          const state = gameRef.current?.getState();
          if (state && user && gameRecord) {
            submitScore(gameRecord.id, user.id, state.score);
          }
        });

        return () => {
          offGameOver();
        };
      } catch (err) {
        if (!destroyed) {
          setError(err instanceof Error ? err.message : "Failed to load game");
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      stopAutosave?.();
      stopConnectivity?.();
      gameRef.current?.destroy();
    };
  }, [gameKey, user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Gamepad2 className="h-12 w-12 text-primary mb-4 animate-pulse" />
          <p className="font-heading text-sm text-muted-foreground">Loading game...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="font-heading text-lg font-bold text-foreground mb-2">Error</h2>
          <p className="font-body text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="text-primary font-body text-sm hover:underline"
          >
            Go Back
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-xl font-bold text-foreground">
            {gameTitle}
          </h1>
          <span className="font-body text-xs text-muted-foreground">
            {gameKey}
          </span>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
          <canvas
            ref={canvasRef}
            className="w-full h-[500px] block"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <p className="font-body text-xs text-muted-foreground text-center">
          Progress autosaves every 5 seconds. Score submits on game over.
        </p>
      </div>
    </AppLayout>
  );
};

export default Play;
