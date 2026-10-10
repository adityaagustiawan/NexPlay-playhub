// Creator.tsx — Creator dashboard with tabs:
// Dashboard | Buat Game | Game Saya | Data & Skor | Publikasi
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Gamepad2,
  Plus,
  BarChart3,
  Rocket,
  Trophy,
  Users,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface Game {
  id: string;
  game_key: string;
  title: string;
  description: string | null;
  gameplay: Record<string, unknown>;
  assets: Record<string, unknown>;
  version: number;
  released_at: string | null;
  user_id: string;
  status: string | null;
  is_draft: boolean;
  plays: number;
  created_at: string;
}

const Creator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gameplayJson, setGameplayJson] = useState('{\n  "difficulty": "medium",\n  "levels": 3\n}');
  const [releasing, setReleasing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Error/success messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data state
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [scores, setScores] = useState<
    { id: string; game_id: string; player_id: string; score: number; created_at: string }[]
  >([]);
  const [stats, setStats] = useState({ totalGames: 0, totalScores: 0, totalPlayers: 0, totalPlays: 0 });

  // --- Actions ---

  const loadMyGames = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("games")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyGames((data as Game[]) ?? []);
    setStats((s) => ({ ...s, totalGames: (data as Game[])?.length ?? 0 }));
  };

  const loadScores = async () => {
    if (!user) return;
    const { data: userGames } = await supabase
      .from("games")
      .select("id")
      .eq("user_id", user.id);

    if (!userGames || userGames.length === 0) {
      setScores([]);
      return;
    }

    const gameIds = userGames.map((g) => g.id);
    const { data: scoresData } = await supabase
      .from("scores")
      .select("*")
      .in("game_id", gameIds)
      .order("created_at", { ascending: false })
      .limit(50);

    setScores(scoresData ?? []);
    setStats((s) => ({
      ...s,
      totalScores: scoresData?.length ?? 0,
      totalPlayers: new Set(scoresData?.map((sc) => sc.player_id)).size ?? 0,
    }));
  };

  useEffect(() => {
    loadMyGames();
    loadScores();
  }, [user]);

  const handleCreateGame = async () => {
    if (!user || !title.trim()) return;

    setError(null);
    setSuccess(null);
    setCreating(true);

    try {
      let gameplay: Record<string, unknown>;
      try {
        gameplay = JSON.parse(gameplayJson);
      } catch {
        setError("Invalid JSON in gameplay config. Please fix the JSON format.");
        setCreating(false);
        return;
      }

      const slug = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30);
      const gameKey = `${slug}-${Date.now().toString(36)}`;

      const { data, error: insertError } = await supabase
        .from("games")
        .insert({
          user_id: user.id,
          game_key: gameKey,
          title: title.trim(),
          description: description.trim() || null,
          gameplay,
          assets: {},
          version: 1,
          released_at: null,
          status: "draft",
          is_draft: true,
          plays: 0,
          likes: 0,
          favorites: 0,
          studio_data: {},
          engine_type: "default",
        })
        .select()
        .single();

      if (insertError) {
        setError(`Failed to create game: ${insertError.message}`);
        setCreating(false);
        return;
      }

      await loadMyGames();
      setTitle("");
      setDescription("");
      setGameplayJson('{\n  "difficulty": "medium",\n  "levels": 3\n}');
      setSuccess(`Game "${data.title}" created successfully! Go to Publikasi tab to release it.`);
    } catch (err) {
      setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRelease = async (gameId: string) => {
    if (!user) return;
    setReleasing(gameId);
    setError(null);

    const { data: game } = await supabase
      .from("games")
      .select("game_key, version, title")
      .eq("id", gameId)
      .single();

    if (!game) {
      setReleasing(null);
      return;
    }

    const now = new Date();
    const releasedAt = now.toISOString();

    const { error: releaseError } = await supabase
      .from("games")
      .update({
        released_at: releasedAt,
        version: (game.version ?? 1) + 1,
        status: "published",
        is_draft: false,
      })
      .eq("id", gameId);

    setReleasing(null);

    if (releaseError) {
      setError(`Failed to release: ${releaseError.message}`);
      return;
    }

    const playUrl = `${window.location.origin}/play/${game.game_key}`;
    setSuccess(`Game "${game.title}" released! Play at: ${playUrl}`);

    await loadMyGames();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-1">
            Creator Studio
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            Build, publish, and track your games.
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Buat Game</span>
            </TabsTrigger>
            <TabsTrigger value="games" className="flex items-center gap-1.5">
              <Gamepad2 className="h-4 w-4" />
              <span className="hidden sm:inline">Game Saya</span>
            </TabsTrigger>
            <TabsTrigger value="scores" className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Data & Skor</span>
            </TabsTrigger>
            <TabsTrigger value="publish" className="flex items-center gap-1.5">
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Publikasi</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-bold text-foreground">
                      {stats.totalGames}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Total Games</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Users className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-bold text-foreground">
                      {stats.totalPlayers}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Unique Players</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-bold text-foreground">
                      {stats.totalScores}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Scores Submitted</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Gamepad2 className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-bold text-foreground">
                      {myGames.reduce((sum, g) => sum + (g.plays || 0), 0)}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Total Plays</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-heading text-sm font-bold text-foreground mb-2">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate("/creator")}>
                  <Plus className="h-4 w-4 mr-1" /> New Game
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/explore")}>
                  Browse Games
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Buat Game Tab */}
          <TabsContent value="create" className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground block mb-1">
                  Game Title
                </label>
                <Input
                  placeholder="My Awesome Game"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground block mb-1">
                  Description
                </label>
                <Textarea
                  placeholder="Describe your game..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground block mb-1">
                  Gameplay Config (JSON)
                </label>
                <Textarea
                  placeholder='{"difficulty": "medium", "levels": 3}'
                  value={gameplayJson}
                  onChange={(e) => setGameplayJson(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              <Button onClick={handleCreateGame} disabled={!title.trim() || creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Game
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Game Saya Tab */}
          <TabsContent value="games" className="space-y-4">
            {myGames.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <Gamepad2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">
                  No games yet. Create your first game!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myGames.map((game) => (
                  <div
                    key={game.id}
                    className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-heading text-sm font-bold text-foreground">
                        {game.title}
                      </h3>
                      <p className="font-body text-xs text-muted-foreground">
                        v{game.version} | {game.game_key}
                      </p>
                      {game.released_at ? (
                        <p className="font-body text-xs text-green-500">
                          Released: {new Date(game.released_at).toLocaleString()}
                        </p>
                      ) : (
                        <p className="font-body text-xs text-yellow-500">Draft</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {game.released_at ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/play/${game.game_key}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" /> Play
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/creator")}
                        >
                          <Rocket className="h-4 w-4 mr-1" /> Release
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Data & Skor Tab */}
          <TabsContent value="scores" className="space-y-4">
            {scores.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">
                  No scores submitted yet.
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="font-body text-xs font-medium text-muted-foreground text-left px-4 py-3">
                        Player
                      </th>
                      <th className="font-body text-xs font-medium text-muted-foreground text-left px-4 py-3">
                        Score
                      </th>
                      <th className="font-body text-xs font-medium text-muted-foreground text-left px-4 py-3">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((score) => (
                      <tr key={score.id} className="border-b border-border last:border-0">
                        <td className="font-body text-sm text-foreground px-4 py-3">
                          {score.player_id.slice(0, 8)}...
                        </td>
                        <td className="font-body text-sm text-foreground px-4 py-3">
                          {score.score}
                        </td>
                        <td className="font-body text-sm text-muted-foreground px-4 py-3">
                          {new Date(score.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Publikasi Tab */}
          <TabsContent value="publish" className="space-y-4">
            {myGames.filter((g) => !g.released_at).length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <Rocket className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">
                  All games are released. Create a new one to publish!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myGames
                  .filter((g) => !g.released_at)
                  .map((game) => (
                    <div
                      key={game.id}
                      className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <h3 className="font-heading text-sm font-bold text-foreground">
                          {game.title}
                        </h3>
                        <p className="font-body text-xs text-muted-foreground">
                          v{game.version} | Draft
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRelease(game.id)}
                        disabled={releasing === game.id}
                      >
                        {releasing === game.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Releasing...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4 mr-1" />
                            Rilis
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
              </div>
            )}

            {/* Published games */}
            {myGames.filter((g) => g.released_at).length > 0 && (
              <>
                <h3 className="font-heading text-sm font-bold text-foreground mt-6">
                  Published Games
                </h3>
                <div className="space-y-3">
                  {myGames
                    .filter((g) => g.released_at)
                    .map((game) => (
                      <div
                        key={game.id}
                        className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
                      >
                        <div>
                          <h3 className="font-heading text-sm font-bold text-foreground">
                            {game.title}
                          </h3>
                          <p className="font-body text-xs text-green-500">
                            v{game.version} | Live
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/play/${game.game_key}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" /> Play
                        </Button>
                      </div>
                    ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Creator;
