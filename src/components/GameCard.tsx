import { Game } from "@/data/gameData";
import { Play, Star } from "lucide-react";
import { useState } from "react";

interface GameCardProps {
  game: Game;
  onPlay?: (game: Game) => void;
}

export function GameCard({ game, onPlay }: GameCardProps) {
  return (
    <div className="bg-card border border-border group">
      <div className="relative aspect-square overflow-hidden">
        <img
          src={game.image}
          alt={game.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-0 left-0 bg-primary px-2 py-1">
          <span className="font-heading text-[10px] text-primary-foreground font-bold">
            {game.genre}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-heading text-sm font-bold text-foreground mb-1">
          {game.title}
        </h3>
        <p className="font-body text-xs text-muted-foreground mb-3 line-clamp-2">
          {game.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-3 w-3 text-primary fill-primary" />
            <span className="font-heading text-xs text-foreground">{game.rating}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{game.players} playing</span>
          </div>
          {game.owned ? (
            <button
              onClick={() => onPlay?.(game)}
              className="bg-primary text-primary-foreground font-heading text-xs px-4 py-2 flex items-center gap-1"
            >
              <Play className="h-3 w-3" />
              PLAY
            </button>
          ) : (
            <button className="bg-secondary text-foreground font-heading text-xs px-4 py-2">
              ${game.price}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function IgnitionOverlay({ game, onClose }: { game: Game; onClose: () => void }) {
  const [filled, setFilled] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center"
      onClick={() => { if (filled) onClose(); }}
    >
      <h2 className="font-heading text-3xl text-foreground mb-2">{game.title}</h2>
      <p className="font-body text-sm text-muted-foreground mb-10">by {game.creator}</p>
      <div className="w-80 h-2 bg-secondary relative overflow-hidden">
        <div
          className="h-full bg-primary ignition-bar ignition-fill"
          onAnimationEnd={() => setFilled(true)}
        />
      </div>
      <p className="font-heading text-xs text-muted-foreground mt-4">
        {filled ? "CLICK ANYWHERE TO CONTINUE" : "IGNITING..."}
      </p>
    </div>
  );
}
