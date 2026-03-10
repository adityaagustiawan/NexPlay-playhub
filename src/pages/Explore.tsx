import { AppLayout } from "@/components/AppLayout";
import { GameCard, IgnitionOverlay } from "@/components/GameCard";
import { games, Game } from "@/data/gameData";
import { useState } from "react";
import { Search } from "lucide-react";

const genres = ["ALL", "STRATEGY", "RPG", "RACING", "PUZZLE", "SIMULATION", "HORROR"];

const Explore = () => {
  const [launching, setLaunching] = useState<Game | null>(null);
  const [selectedGenre, setSelectedGenre] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = games.filter((g) => {
    const matchGenre = selectedGenre === "ALL" || g.genre === selectedGenre;
    const matchSearch = g.title.toLowerCase().includes(search.toLowerCase());
    return matchGenre && matchSearch;
  });

  return (
    <AppLayout>
      {launching && (
        <IgnitionOverlay game={launching} onClose={() => setLaunching(null)} />
      )}

      <h1 className="font-heading text-3xl font-bold text-foreground mb-6">EXPLORE</h1>

      {/* Search */}
      <div className="flex items-center bg-card border border-border px-4 py-3 mb-6 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground mr-3" />
        <input
          type="text"
          placeholder="Search games..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent font-body text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
        />
      </div>

      {/* Genre Filter */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className={`font-heading text-xs px-4 py-2 border ${
              selectedGenre === genre
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border"
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((game) => (
          <GameCard key={game.id} game={game} onPlay={setLaunching} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="font-heading text-muted-foreground">NO GAMES FOUND</p>
        </div>
      )}
    </AppLayout>
  );
};

export default Explore;
