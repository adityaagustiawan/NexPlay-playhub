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
import { Gamepad2, AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ReportButton } from "@/components/ReportDialog";
import { GameStore } from "@/components/GameStore";

const Play = () => {
  const { gameKey } = useParams<{ gameKey: string }>();
  const { user, isBlocked } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameInstance | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameTitle, setGameTitle] = useState<string>("");
  const [gameId, setGameId] = useState<string>("");
  const [creatorId, setCreatorId] = useState<string>("");
  const [creatorName, setCreatorName] = useState<string>("");
  const [liveNonce, setLiveNonce] = useState(0);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const loadedVersionRef = useRef<number>(-1);

  useEffect(() => {
    if (!gameKey || !canvasRef.current) return;
    // Suspended or banned accounts cannot play until the block is lifted.
    if (isBlocked) {
      setLoading(false);
      return;
    }

    let destroyed = false;
    let stopAutosave: (() => void) | null = null;
    let stopConnectivity: (() => void) | null = null;
    let offGameOver: (() => void) | null = null;

    const init = async () => {
      try {
        // 1. Load game package
        const pkg = await loadGamePackage(gameKey);
        if (destroyed) return;

        setGameTitle(pkg.title ?? gameKey);
        setLoading(false);
        loadedVersionRef.current = pkg.version ?? 0;

        // 2. Get game ID for score submission (and its creator, for reporting).
        const { data: gameRecord } = await supabase
          .from("games")
          .select("id, user_id")
          .eq("game_key", gameKey)
          .maybeSingle();

        if (gameRecord) {
          setGameId(gameRecord.id);
          setCreatorId(gameRecord.user_id ?? "");
          if (gameRecord.user_id) {
            const { data: creator } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("user_id", gameRecord.user_id)
              .maybeSingle();
            if (creator?.display_name) setCreatorName(creator.display_name);
          }
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
        offGameOver = eventBus.on(EngineEvents.GameOver, () => {
          const state = gameRef.current?.getState();
          if (state && user && gameRecord) {
            submitScore(gameRecord.id, user.id, state.score);
          }
        });
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
      offGameOver?.();
      stopAutosave?.();
      stopConnectivity?.();
      gameRef.current?.destroy();
    };
  }, [gameKey, user, liveNonce, isBlocked]);

  // Live updates: a Nexstudio publish/update bumps games.version. When that
  // happens for the game currently open, remount it with the new package.
  useEffect(() => {
    if (!gameKey) return;
    const channel = supabase
      .channel(`game-updates-${gameKey}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `game_key=eq.${gameKey}` },
        (payload) => {
          const incoming = payload.new as { version?: number };
          if (typeof incoming.version !== "number") return;
          if (loadedVersionRef.current >= 0 && incoming.version > loadedVersionRef.current) {
            setLiveNotice(`Creator updated this game to v${incoming.version} — refreshing…`);
            setLiveNonce((n) => n + 1);
            window.setTimeout(() => setLiveNotice(null), 4000);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameKey]);

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

  if (isBlocked) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
          <h2 className="font-heading text-lg font-bold text-foreground mb-2">Playback unavailable</h2>
          <p className="font-body text-sm text-muted-foreground">
            Your account is suspended or banned, so games can't be played right now.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-heading text-xl font-bold text-foreground">
            {gameTitle}
          </h1>
          <div className="flex items-center gap-3">
            {creatorId && (
              <ReportButton targetUserId={creatorId} targetName={creatorName || "creator"} label="Report creator" />
            )}
            <span className="font-body text-xs text-muted-foreground">
              {gameKey}
            </span>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
          <canvas
            ref={canvasRef}
            className="w-full h-[500px] block"
            style={{ imageRendering: "pixelated" }}
          />
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70">
              <Gamepad2 className="h-12 w-12 text-primary mb-4 animate-pulse" />
              <p className="font-heading text-sm text-muted-foreground">Loading game...</p>
            </div>
          )}
        </div>

        {liveNotice && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-body text-primary">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> {liveNotice}
          </div>
        )}

        <p className="font-body text-xs text-muted-foreground text-center">
          Progress autosaves every 5 seconds. Score submits on game over.
        </p>
      </div>
    </AppLayout>
  );
};

export default Play;
