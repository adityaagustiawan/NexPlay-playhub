import { AppLayout } from "@/components/AppLayout";
import { GameRow } from "@/components/GameRow";
import { Sparkles } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const genres = ["All", "Action", "Strategy", "RPG", "Racing", "Puzzle", "Simulation", "Horror", "Adventure"];

const Explore = () => {
  return (
    <AppLayout>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Discover</h1>

      {/* Genre Filter */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {genres.map((genre) => (
          <button
            key={genre}
            className={`font-body text-sm px-4 py-2 rounded-lg border transition-colors ${
              genre === "All"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Empty Sections */}
      <GameRow
        title="🎮 All Games"
        isEmpty
        emptyMessage="No games have been created yet. Be the first creator on NEXPLAY.AI!"
      >
        {null}
      </GameRow>

      <GameRow
        title="⭐ Top Rated"
        isEmpty
        emptyMessage="Top rated games by the community will appear here."
      >
        {null}
      </GameRow>

      <GameRow
        title="👥 Most Played"
        isEmpty
        emptyMessage="The most popular games will show up here once players start exploring."
      >
        {null}
      </GameRow>

      {/* CTA */}
      <div className="bg-card border border-border rounded-2xl p-8 text-center mt-4">
        <h3 className="font-heading text-lg font-bold text-foreground mb-2">No games to discover yet?</h3>
        <p className="font-body text-sm text-muted-foreground mb-4">
          Create one with AI and share it with the world.
        </p>
        <NavLink
          to="/create"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-6 py-3 rounded-lg"
        >
          <Sparkles className="h-4 w-4" />
          Start Creating
        </NavLink>
      </div>
    </AppLayout>
  );
};

export default Explore;
