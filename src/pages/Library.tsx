import { AppLayout } from "@/components/AppLayout";
import { GameRow } from "@/components/GameRow";
import { Sparkles, Gamepad2, TrendingUp, Star, Clock } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const Library = () => {
  return (
    <AppLayout>
      {/* Welcome Hero */}
      <div className="bg-gradient-to-br from-primary/20 via-card to-card border border-border rounded-2xl p-8 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
              Welcome to NEXPLAY.AI
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

      {/* Recommendation Sections — all empty for now */}
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
        title="🕹️ Recently Played"
        isEmpty
        emptyMessage="Your recently played games will show up here."
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
