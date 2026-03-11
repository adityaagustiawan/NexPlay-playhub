import { AppLayout } from "@/components/AppLayout";
import { useParams, useNavigate } from "react-router-dom";
import { games } from "@/data/gameData";
import { Play, ArrowLeft, Eye, Star, User, Gamepad2 } from "lucide-react";
import { IgnitionOverlay } from "@/components/GameCard";
import { useState } from "react";

const GameDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const game = games.find((g) => g.id === id);
  const [launching, setLaunching] = useState(false);

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
      {launching && <IgnitionOverlay game={game} onClose={() => setLaunching(false)} />}

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
            <img
              src={game.image}
              alt={game.title}
              className="w-full h-full object-cover"
            />
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
              onClick={() => setLaunching(true)}
              className="w-full bg-primary text-primary-foreground font-heading text-sm font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Play className="h-5 w-5" />
              Play Now
            </button>

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
