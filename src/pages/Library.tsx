import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GameRow } from "@/components/GameRow";
import { Sparkles, Gamepad2, Clock, CheckCircle2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { formatPlayTime, listRecentProgress, timeAgo, type GameProgress } from "@/lib/progress";

const Library = () => {
  const { user } = useAuth();
  const [recent, setRecent] = useState<GameProgress[]>([]);

  useEffect(() => {
    if (!user) {
      setRecent([]);
      return;
    }
    let active = true;
    listRecentProgress(user.id, 8)
      .then((rows) => {
        if (active) setRecent(rows);
      })
      .catch(() => {
        /* best-effort: an empty shelf is fine if loading fails */
      });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <AppLayout>
      {/* Welcome Hero */}
      <div className="bg-gradient-to-br from-primary/20 via-card to-card border border-border rounded-2xl p-8 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
              Welcome to NEXCONSOLE
            </h1>
            <p className="font-body text-muted-foreground max-w-lg mb-6">
              Play games created by the community, or build your own with AI. 
              Everything starts with an idea.
            </p>
            <NavLink
              to="/create"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Sparkles className="h-4 w-4" />
              Create Your First Game
            </NavLink>
          </div>
          <Gamepad2 className="h-20 w-20 text-primary/30 animate-float hidden lg:block" />
        </div>
      </div>

      {/* Continue Playing — the player's own saved progress, synced to their account */}
      <GameRow
        title="🕹️ Continue Playing"
        isEmpty={recent.length === 0}
        emptyMessage="No saved games yet. Play a game and your progress will be saved here — sign in with Google to pick up where you left off on any device."
      >
        {recent.map((p) => (
          <NavLink
            key={p.gameId}
            to={`/game/${p.gameId}`}
            className="group flex-shrink-0 w-[200px]"
          >
            <div className="relative aspect-square overflow-hidden rounded-xl mb-2 bg-card border border-border">
              {p.gameImage ? (
                <img
                  src={p.gameImage}
                  alt={p.gameTitle ?? "Saved game"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-card to-card">
                  <Gamepad2 className="h-12 w-12 text-primary/40" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-background/70 backdrop-blur-sm rounded-md px-2 py-1">
                <Clock className="h-3 w-3 text-foreground" />
                <span className="font-body text-[11px] text-foreground font-medium">
                  {formatPlayTime(p.playSeconds)}
                </span>
              </div>
              {p.completed && (
                <div className="absolute top-2 right-2 bg-background/70 backdrop-blur-sm rounded-full p-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
            </div>
            <h3 className="font-heading text-sm font-semibold text-foreground truncate">
              {p.gameTitle ?? "Untitled game"}
            </h3>
            <p className="font-body text-xs text-muted-foreground truncate">
              Last played {timeAgo(p.lastPlayedAt)}
            </p>
          </NavLink>
        ))}
      </GameRow>

      <GameRow
        title="🔥 Players' Choice"
        isEmpty
        emptyMessage="No community favorites yet. Games created by users will appear here once they gain popularity!"
      >
        {null}
      </GameRow>

      <GameRow
        title="📈 Trending"
        isEmpty
        emptyMessage="Trending games will show up here. Create a game and watch it climb the charts!"
      >
        {null}
      </GameRow>

      <GameRow
        title="✨ Recommended For You"
        isEmpty
        emptyMessage="Play some games first, and we'll recommend titles based on your taste."
      >
        {null}
      </GameRow>

      <GameRow
        title="🆕 New Releases"
        isEmpty
        emptyMessage="New games from the community will appear here. Why not create the first one?"
      >
        {null}
      </GameRow>
    </AppLayout>
  );
};

export default Library;
