import { Game } from "@/data/gameData";
import { Play, Star, Eye } from "lucide-react";
import { useState } from "react";

interface GameCardProps {
  game: Game;
  onPlay?: (game: Game) => void;
}

export function GameCard({ game, onPlay }: GameCardProps) {
  return (
    <div className="group cursor-pointer flex-shrink-0 w-[200px]">
      <div className="relative aspect-square overflow-hidden rounded-xl mb-2">
        <img
          src={game.image}
          alt={game.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/40 transition-colors flex items-center justify-center">
          <button
            onClick={() => onPlay?.(game)}
            className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-full p-3"
          >
            <Play className="h-5 w-5" />
          </button>
        </div>
        {/* Play count badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-background/70 backdrop-blur-sm rounded-md px-2 py-1">
          <Eye className="h-3 w-3 text-foreground" />
          <span className="font-body text-[11px] text-foreground font-medium">{game.players}</span>
        </div>
      </div>
      <h3 className="font-heading text-sm font-semibold text-foreground truncate">
        {game.title}
      </h3>
      <p className="font-body text-xs text-muted-foreground truncate">
        {game.creator}
      </p>
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
      <h2 className="font-heading text-3xl font-bold text-foreground mb-2">{game.title}</h2>
      <p className="font-body text-sm text-muted-foreground mb-10">by {game.creator}</p>
      <div className="w-80 h-2 bg-secondary rounded-full relative overflow-hidden">
        <div
          className="h-full bg-primary rounded-full ignition-bar ignition-fill"
          onAnimationEnd={() => setFilled(true)}
        />
      </div>
      <p className="font-heading text-xs text-muted-foreground mt-4">
        {filled ? "CLICK ANYWHERE TO CONTINUE" : "LOADING..."}
      </p>
    </div>
  );
}
