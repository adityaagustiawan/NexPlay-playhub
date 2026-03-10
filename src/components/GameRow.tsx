import { ReactNode, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface GameRowProps {
  title: string;
  children: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export function GameRow({ title, children, emptyMessage, isEmpty }: GameRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
        {!isEmpty && (
          <div className="flex gap-1">
            <button onClick={() => scroll("left")} className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => scroll("right")} className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
          <p className="font-body text-sm text-muted-foreground text-center">
            {emptyMessage || "No games yet. Be the first to create one!"}
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
          {children}
        </div>
      )}
    </section>
  );
}
