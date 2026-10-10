// Creator.tsx — Creator Studio inspired by Astrocade's clean AI-first design.
// Tabs: Create | My Games | Analytics | Earn
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
  DollarSign,
  Trophy,
  Users,
  ExternalLink,
  AlertCircle,
  Loader2,
  Sparkles,
  TrendingUp,
  Eye,
  Heart,
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
  likes: number;
  favorites: number;
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

  // --- Actions ---

  const loadMyGames = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("games")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyGames((data as Game[]) ?? []);
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
      .limit(100);

    setScores(scoresData ?? []);
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
      setSuccess(`Game "${data.title}" created! Go to My Games to publish it.`);
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

    const { error: releaseError } = await supabase
      .from("games")
      .update({
        released_at: new Date().toISOString(),
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
    setSuccess(`Game "${game.title}" is now live! Play at: ${playUrl}`);

    await loadMyGames();
  };

  const totalPlays = myGames.reduce((sum, g) => sum + (g.plays || 0), 0);
  const totalLikes = myGames.reduce((sum, g) => sum + (g.likes || 0), 0);
  const totalFavorites = myGames.reduce((sum, g) => sum + (g.favorites || 0), 0);
  const publishedCount = myGames.filter((g) => g.released_at).length;
  const draftCount = myGames.filter((g) => !g.released_at).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Creator Studio
            </h1>
            <p className="font-body text-sm text-muted-foreground">
              Build, publish, and monetize your games.
            </p>
          </div>
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

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create" className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Create</span>
            </TabsTrigger>
            <TabsTrigger value="games" className="flex items-center gap-1.5">
              <Gamepad2 className="h-4 w-4" />
              <span className="hidden sm:inline">My Games</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="earn" className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Earn</span>
            </TabsTrigger>
          </TabsList>

          {/* CREATE TAB — AI-first, like Astrocade */}
          <TabsContent value="create" className="space-y-6">
            {/* AI Prompt Area */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold text-foreground">
                    Describe your game
                  </h3>
                  <p className="font-body text-xs text-muted-foreground">
                    Tell AI what you want to create
                  </p>
                </div>
              </div>
              <Textarea
                placeholder="e.g. A 2D platformer where you're a cat collecting fish in space..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[100px]"
              />
            </div>

            {/* Game Details Form */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-heading text-sm font-bold text-foreground">
                Game Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Genre
                  </label>
                  <Input
                    placeholder="Platformer, Puzzle, RPG..."
                    disabled
                  />
                </div>
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground block mb-1">
                  Description
                </label>
                <Textarea
                  placeholder="Describe your game..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
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

          {/* MY GAMES TAB */}
          <TabsContent value="games" className="space-y-4">
            {myGames.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center">
                <Gamepad2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-body text-sm text-muted-foreground">
                  No games yet. Create your first game!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myGames.map((game) => (
                  <div
                    key={game.id}
                    className="bg-card border border-border rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-heading text-sm font-bold text-foreground">
                          {game.title}
                        </h3>
                        <p className="font-body text-xs text-muted-foreground">
                          v{game.version} | {game.game_key}
                        </p>
                      </div>
                      <span
                        className={`font-body text-xs px-2 py-0.5 rounded-full ${
                          game.released_at
                            ? "bg-green-500/20 text-green-500"
                            : "bg-yellow-500/20 text-yellow-500"
                        }`}
                      >
                        {game.released_at ? "Live" : "Draft"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{game.plays || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        <span>{game.likes || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        <span>
                          {scores.filter((s) => s.game_id === game.id).length}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {game.released_at ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => navigate(`/play/${game.game_key}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" /> Play
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
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
                              <TrendingUp className="h-4 w-4 mr-1" />
                              Publish
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Eye className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-bold text-foreground">
                      {totalPlays}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Total Plays</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <Heart className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-bold text-foreground">
                      {totalLikes}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Total Likes</p>
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
                      {publishedCount}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Published</p>
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
                      {scores.length}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Scores</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Performance Table */}
            {myGames.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="font-heading text-sm font-bold text-foreground">
                    Game Performance
                  </h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="font-body text-xs font-medium text-muted-foreground text-left px-4 py-3">
                        Game
                      </th>
                      <th className="font-body text-xs font-medium text-muted-foreground text-left px-4 py-3">
                        Plays
                      </th>
                      <th className="font-body text-xs font-medium text-muted-foreground text-left px-4 py-3">
                        Likes
                      </th>
                      <th className="font-body text-xs font-medium text-muted-foreground text-left px-4 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {myGames.map((game) => (
                      <tr key={game.id} className="border-b border-border last:border-0">
                        <td className="font-body text-sm text-foreground px-4 py-3">
                          {game.title}
                        </td>
                        <td className="font-body text-sm text-foreground px-4 py-3">
                          {game.plays || 0}
                        </td>
                        <td className="font-body text-sm text-foreground px-4 py-3">
                          {game.likes || 0}
                        </td>
                        <td className="font-body text-sm px-4 py-3">
                          <span
                            className={`font-body text-xs px-2 py-0.5 rounded-full ${
                              game.released_at
                                ? "bg-green-500/20 text-green-500"
                                : "bg-yellow-500/20 text-yellow-500"
                            }`}
                          >
                            {game.released_at ? "Live" : "Draft"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* EARN TAB */}
          <TabsContent value="earn" className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <DollarSign className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">
                Earn from Your Games
              </h3>
              <p className="font-body text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Monetize your games with in-game purchases, ads, and premium features.
                Revenue sharing coming soon.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="bg-secondary rounded-lg p-4">
                  <p className="font-heading text-xl font-bold text-foreground">
                    {totalPlays}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">Total Plays</p>
                </div>
                <div className="bg-secondary rounded-lg p-4">
                  <p className="font-heading text-xl font-bold text-foreground">
                    {publishedCount}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">Live Games</p>
                </div>
                <div className="bg-secondary rounded-lg p-4">
                  <p className="font-heading text-xl font-bold text-foreground">$0</p>
                  <p className="font-body text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Creator;
