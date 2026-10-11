// Create.tsx — the free "Create" workspace.
// Anyone can describe a game and let NexCode build it. Free tier is a trial of
// up to 5 games (enforced server-side); Pro Creator lifts the limit. Creators
// can play, submit for review, and delete their own games.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useNexCode } from "@/hooks/useNexCode";
import { NexCodeTerminal } from "@/components/NexCodeTerminal";
import { GamePreview } from "@/components/GamePreview";
import type { GamePackage } from "@/engine/gameLoader";
import { asJson } from "@/lib/supabaseJson";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles,
  Loader2,
  Trash2,
  Play,
  Crown,
  Lock,
  Gamepad2,
  CheckCircle2,
  Send,
  ArrowRight,
} from "lucide-react";

const FREE_TRIAL_LIMIT = 5;

interface Game {
  id: string;
  game_key: string;
  title: string;
  description: string | null;
  status: string | null;
  is_draft: boolean;
  released_at: string | null;
  created_at: string;
  plays: number;
  engine_type: string | null;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30) || "game"
  );
}

const Create = () => {
  const { user, session, profile } = useAuth();
  const navigate = useNavigate();
  const nexcode = useNexCode();

  const isPro = profile?.creator_tier === "pro";
  const [prompt, setPrompt] = useState("");
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ pkg: GamePackage; gameKey: string; title: string } | null>(null);
  const renderCheckedRef = useRef<Set<string>>(new Set());

  const atLimit = !isPro && myGames.length >= FREE_TRIAL_LIMIT;
  const remaining = Math.max(0, FREE_TRIAL_LIMIT - myGames.length);

  const loadGames = async () => {
    if (!user) {
      setMyGames([]);
      setLoadingGames(false);
      return;
    }
    setLoadingGames(true);
    const { data } = await supabase
      .from("games")
      .select("id, game_key, title, description, status, is_draft, released_at, created_at, plays, engine_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyGames((data as Game[]) ?? []);
    setLoadingGames(false);
  };

  useEffect(() => {
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleGenerate = async () => {
    if (!user) return;
    if (!prompt.trim()) return;
    setNotice(null);
    setError(null);

    if (atLimit) {
      setError(
        `Free trial is limited to ${FREE_TRIAL_LIMIT} games. Top up any amount to unlock Pro Creator (unlimited).`
      );
      return;
    }

    nexcode.clear();
    const game = await nexcode.run(prompt.trim(), session?.access_token);
    if (!game) return; // blocked or failed — terminal already shows why

    // Persist the generated game. RLS + the free-trial trigger are authoritative.
    const gameKey = `${slugify(game.title)}-${Date.now().toString(36)}`;
    const { error: insertError } = await supabase.from("games").insert({
      user_id: user.id,
      game_key: gameKey,
      title: game.title,
      description: game.description,
      gameplay: asJson(game.gameplay),
      assets: asJson(game.assets),
      version: 1,
      released_at: null,
      status: "draft",
      is_draft: true,
      plays: 0,
      likes: 0,
      favorites: 0,
      studio_data: {},
      engine_type: "nexcode",
    });

    if (insertError) {
      setError(`Could not save the game: ${insertError.message}`);
      return;
    }

    setPrompt("");
    await loadGames();

    // Make it playable immediately, inline — no need to leave the page.
    setPreview({
      pkg: { gameplay: game.gameplay, assets: game.assets, title: game.title },
      gameKey,
      title: game.title,
    });
    setNotice(`“${game.title}” was verified and is ready to play below.`);
  };

  const handleSubmit = async (game: Game) => {
    if (!user) return;
    setBusyId(game.id);
    setError(null);
    const { error: updErr } = await supabase
      .from("games")
      .update({
        released_at: new Date().toISOString(),
        version: 1,
        status: "pending",
        is_draft: false,
      })
      .eq("id", game.id);
    setBusyId(null);
    if (updErr) {
      setError(`Could not submit: ${updErr.message}`);
      return;
    }
    setNotice(`“${game.title}” submitted for review. You can play it now from your library.`);
    await loadGames();
  };

  const handleDelete = async (game: Game) => {
    if (!user) return;
    if (!window.confirm(`Delete “${game.title}”? This cannot be undone.`)) return;
    setBusyId(game.id);
    setError(null);
    const { error: delErr } = await supabase.from("games").delete().eq("id", game.id);
    setBusyId(null);
    if (delErr) {
      setError(`Could not delete: ${delErr.message}`);
      return;
    }
    setNotice(`“${game.title}” deleted.`);
    await loadGames();
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-1">Create</h1>
            <p className="font-body text-sm text-muted-foreground">
              Describe a game and <span className="text-primary font-medium">NexCode</span> builds it —
              playable in seconds.
            </p>
          </div>
          {/* Trial / Pro badge */}
          <div
            className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full font-body text-sm font-semibold ${
              isPro ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
            }`}
          >
            {isPro ? <Crown className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {isPro ? "Pro Creator — unlimited" : `Trial ${myGames.length}/${FREE_TRIAL_LIMIT}`}
          </div>
        </div>

        {!user && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <h2 className="font-heading text-lg font-bold text-foreground mb-1">
              Sign in to start creating
            </h2>
            <p className="font-body text-sm text-muted-foreground mb-5">
              You get a free trial of {FREE_TRIAL_LIMIT} games. Top up once for unlimited.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/signup">Create account</Link>
              </Button>
            </div>
          </div>
        )}

        {user && (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {notice && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}

            {/* Free trial banner */}
            {!isPro && (
              <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Lock className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-body text-sm font-medium text-foreground">
                      Free trial: {myGames.length}/{FREE_TRIAL_LIMIT} games used
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      Top up any amount once to unlock Pro Creator — unlimited games.
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => navigate("/topup?unlock=pro")}>
                  <Crown className="h-4 w-4 mr-1" />
                  Go Pro
                </Button>
              </div>
            )}

            {/* Prompt + NexCode terminal */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold text-foreground">Describe your game</h3>
                  <p className="font-body text-xs text-muted-foreground">
                    NexCode only builds games — it can't touch the backend or the website.
                  </p>
                </div>
              </div>

              <Textarea
                placeholder="e.g. A neon space catcher where you grab energy cores and dodge meteors"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                disabled={nexcode.running}
              />

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || nexcode.running || atLimit}
                >
                  {nexcode.running ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Building…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Game
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                {!isPro && (
                  <span className="font-body text-xs text-muted-foreground">
                    {atLimit ? "Trial limit reached." : `${remaining} trial game${remaining === 1 ? "" : "s"} left.`}
                  </span>
                )}
              </div>

              {/* Terminal */}
              {(nexcode.lines.length > 0 || nexcode.running) && (
                <NexCodeTerminal lines={nexcode.lines} running={nexcode.running} />
              )}
            </div>

            {/* Inline play — appears immediately after NexCode finishes */}
            {preview && (
              <div className="bg-card border border-emerald-500/30 rounded-2xl p-6">
                <GamePreview
                  pkg={preview.pkg}
                  title={preview.title}
                  onOpenFull={() => navigate(`/play/${preview.gameKey}`)}
                  onRendered={() => {
                    if (renderCheckedRef.current.has(preview.gameKey)) return;
                    renderCheckedRef.current.add(preview.gameKey);
                    nexcode.pushLine("ok", "Render check ✔ — game is displayed and playable.");
                  }}
                  onError={(msg) => {
                    nexcode.pushLine("error", `Render check ✖ — game failed to display: ${msg}`);
                    setError(`The game was built but failed to display: ${msg}`);
                  }}
                />
              </div>
            )}

            {/* Your Projects */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-lg font-bold text-foreground">Your Projects</h2>
                {myGames.length > 0 && (
                  <span className="font-body text-xs text-muted-foreground">
                    {myGames.length} game{myGames.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {loadingGames ? (
                <div className="bg-card border border-border rounded-xl p-10 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : myGames.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
                  <Gamepad2 className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-body text-sm text-muted-foreground text-center">
                    No games yet. Describe an idea above and press Generate.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myGames.map((game) => {
                    const submitted = !!game.released_at;
                    return (
                      <div key={game.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-heading text-sm font-bold text-foreground truncate">
                              {game.title}
                            </h3>
                            <p className="font-body text-xs text-muted-foreground truncate">
                              {game.engine_type === "nexcode" ? "NexCode" : "Manual"} · {game.game_key}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 font-body text-xs px-2 py-0.5 rounded-full ${
                              submitted
                                ? "bg-green-500/20 text-green-500"
                                : "bg-yellow-500/20 text-yellow-500"
                            }`}
                          >
                            {submitted ? "Submitted" : "Draft"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/play/${game.game_key}`)}
                          >
                            <Play className="h-4 w-4 mr-1" /> Play
                          </Button>
                          {!submitted && (
                            <Button
                              size="sm"
                              onClick={() => handleSubmit(game)}
                              disabled={busyId === game.id}
                            >
                              {busyId === game.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 mr-1" />
                              )}
                              Submit
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(game)}
                            disabled={busyId === game.id}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Create;
