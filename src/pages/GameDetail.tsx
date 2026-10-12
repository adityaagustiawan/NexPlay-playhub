import { AppLayout } from "@/components/AppLayout";
import { useParams, useNavigate } from "react-router-dom";
import { games as staticGames, Game } from "@/data/gameData";
import { Play, ArrowLeft, Eye, Star, User, Gamepad2, Save, Trophy, Clock, CheckCircle2, RotateCcw } from "lucide-react";
import { IgnitionOverlay } from "@/components/GameCard";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { deleteProgress, formatPlayTime, loadProgress, saveProgress, timeAgo, type GameProgress } from "@/lib/progress";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CommunityGameRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  plays: number | null;
  engine_type: string | null;
}

const GameDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const localGame = staticGames.find((g) => g.id === id);
  const [game, setGame] = useState<Game | undefined>(localGame);
  const [resolving, setResolving] = useState(!localGame);
  const [launching, setLaunching] = useState(false);
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const sessionStart = useRef<number | null>(null);

  // Resolve community-created games (uuid ids) that aren't in the static list.
  useEffect(() => {
    const local = staticGames.find((g) => g.id === id);
    if (local || !id || !UUID_RE.test(id)) {
      setGame(local);
      setResolving(false);
      return;
    }
    let active = true;
    setResolving(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("games")
          .select("id,title,description,image_url,plays,engine_type")
          .eq("id", id)
          .maybeSingle();
        if (!active) return;
        if (data) {
          const row = data as unknown as CommunityGameRow;
          setGame({
            id: row.id,
            title: row.title,
            description: row.description ?? "",
            image: row.image_url ?? "",
            genre: row.engine_type ?? "Community",
            rating: 0,
            players: String(row.plays ?? 0),
            owned: true,
            creator: "Community Creator",
          });
        } else {
          setGame(undefined);
        }
      } catch {
        if (active) setGame(undefined);
      } finally {
        if (active) setResolving(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Load this player's saved progress for the game.
  useEffect(() => {
    if (!user || !id) {
      setProgress(null);
      return;
    }
    let active = true;
    loadProgress(user.id, id)
      .then((p) => {
        if (active) setProgress(p);
      })
      .catch(() => {
        /* progress is best-effort; a missing table shouldn't break the page */
      });
    return () => {
      active = false;
    };
  }, [user, id]);

  // Persist elapsed play time for the current session (called on close/unmount).
  const flushSession = useCallback(async (force = false) => {
    if (!user || !id) return;
    if (sessionStart.current == null && !force) return;
    const elapsed =
      sessionStart.current != null ? Math.round((Date.now() - sessionStart.current) / 1000) : 0;
    sessionStart.current = null;
    setSaving(true);
    try {
      const saved = await saveProgress(user.id, id, {
        gameTitle: game?.title ?? null,
        gameImage: game?.image ?? null,
        addPlaySeconds: elapsed,
        playedNow: true,
      });
      setProgress(saved);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch {
      /* ignore — progress saving is best-effort */
    } finally {
      setSaving(false);
    }
  }, [user, id, game]);

  useEffect(() => {
    return () => {
      void flushSession();
    };
  }, [flushSession]);

  const handlePlay = () => {
    sessionStart.current = Date.now();
    setLaunching(true);
  };

  const handleCloseOverlay = () => {
    setLaunching(false);
    void flushSession();
  };

  const handleReset = async () => {
    if (!user || !id) return;
    try {
      await deleteProgress(user.id, id);
      setProgress(null);
    } catch {
      /* ignore */
    }
  };

  if (resolving) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Gamepad2 className="h-12 w-12 text-primary/50 animate-pulse mb-4" />
          <p className="font-body text-sm text-muted-foreground">Loading game…</p>
        </div>
      </AppLayout>
    );
  }

  if (!game) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Gamepad2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">Game Not Found</h2>
          <p className="font-body text-sm text-muted-foreground mb-4">
            This game doesn't exist or hasn't been created yet.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-primary font-body text-sm hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {launching && <IgnitionOverlay game={game} onClose={handleCloseOverlay} />}

      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hero Image */}
        <div className="lg:col-span-2">
          <div className="aspect-video rounded-2xl overflow-hidden bg-card border border-border">
            {game.image ? (
              <img src={game.image} alt={game.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-card to-card">
                <Gamepad2 className="h-20 w-20 text-primary/40" />
              </div>
            )}
          </div>

          {/* Saved progress */}
          <div className="bg-card border border-border rounded-2xl p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                <Trophy className="h-5 w-5 text-accent" />
                Your Progress
              </h2>
              {saving && <span className="font-body text-xs text-muted-foreground">Saving…</span>}
              {justSaved && !saving && (
                <span className="font-body text-xs text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved to your account
                </span>
              )}
            </div>

            {!user ? (
              <p className="font-body text-sm text-muted-foreground">
                Sign in to save your progress and continue on any device.
              </p>
            ) : progress ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-secondary rounded-xl p-3 text-center">
                    <p className="font-heading text-xl font-bold text-foreground">{progress.level}</p>
                    <p className="font-body text-xs text-muted-foreground">Level</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-3 text-center">
                    <p className="font-heading text-xl font-bold text-foreground">{progress.score.toLocaleString()}</p>
                    <p className="font-body text-xs text-muted-foreground">Score</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-3 text-center">
                    <p className="font-heading text-xl font-bold text-foreground">{formatPlayTime(progress.playSeconds)}</p>
                    <p className="font-body text-xs text-muted-foreground">Played</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-body text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Last played {timeAgo(progress.lastPlayedAt)}
                    {progress.completed && (
                      <span className="ml-2 text-primary inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                      </span>
                    )}
                  </p>
                  <button
                    onClick={handleReset}
                    className="font-body text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                </div>
              </>
            ) : (
              <p className="font-body text-sm text-muted-foreground">
                No saved progress yet. Hit <span className="text-foreground font-medium">Play Now</span> and your
                progress will be saved to your account automatically.
              </p>
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h1 className="font-heading text-2xl font-bold text-foreground mb-1">{game.title}</h1>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-body text-sm text-muted-foreground">{game.creator}</span>
            </div>

            <p className="font-body text-sm text-muted-foreground mb-6">{game.description}</p>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="font-body text-sm text-foreground">{game.players}</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-accent" />
                <span className="font-body text-sm text-foreground">{game.rating}</span>
              </div>
              <span className="bg-secondary px-3 py-1 rounded-full font-body text-xs text-muted-foreground">
                {game.genre}
              </span>
            </div>

            <button
              onClick={handlePlay}
              className="w-full bg-primary text-primary-foreground font-heading text-sm font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Play className="h-5 w-5" />
              {progress ? "Continue" : "Play Now"}
            </button>

            {user && (
              <button
                onClick={() => void flushSession(true)}
                disabled={saving}
                className="w-full mt-2 bg-secondary text-foreground font-heading text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 border border-border hover:bg-secondary/70 transition-colors disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save Progress"}
              </button>
            )}

            {game.price && game.price > 0 && !game.owned && (
              <p className="font-body text-xs text-muted-foreground text-center mt-2">
                {game.price} NexCoins
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default GameDetail;
