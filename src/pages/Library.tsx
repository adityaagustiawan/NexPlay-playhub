import { AppLayout } from "@/components/AppLayout";
import { GameCard, IgnitionOverlay } from "@/components/GameCard";
import { games, Game } from "@/data/gameData";
import { useState } from "react";
import heroBanner from "@/assets/hero-banner.jpg";

const Library = () => {
  const [launching, setLaunching] = useState<Game | null>(null);
  const ownedGames = games.filter((g) => g.owned);

  return (
    <AppLayout>
      {launching && (
        <IgnitionOverlay game={launching} onClose={() => setLaunching(null)} />
      )}

      {/* Hero */}
      <div className="relative w-full h-64 mb-8 overflow-hidden border border-border">
        <img src={heroBanner} alt="Astrocade" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-background/60 flex flex-col justify-center px-10">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
            YOUR LIBRARY
          </h1>
          <p className="font-body text-muted-foreground max-w-md">
            {ownedGames.length} games ready to play. Select a title and ignite.
          </p>
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ownedGames.map((game) => (
          <GameCard key={game.id} game={game} onPlay={setLaunching} />
        ))}
      </div>
    </AppLayout>
  );
};

export default Library;
