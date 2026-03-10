import { AppLayout } from "@/components/AppLayout";
import { friends } from "@/data/gameData";
import { UserPlus, MessageSquare, Gamepad2 } from "lucide-react";
import { useState } from "react";

const Friends = () => {
  const [filter, setFilter] = useState<"all" | "online" | "in-game">("all");

  const filtered = friends.filter((f) => {
    if (filter === "all") return true;
    if (filter === "online") return f.status === "online" || f.status === "in-game";
    return f.status === "in-game";
  });

  const statusColor = (status: string) => {
    if (status === "online") return "bg-primary";
    if (status === "in-game") return "bg-accent";
    return "bg-muted-foreground";
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl font-bold text-foreground">FRIENDS</h1>
        <button className="bg-primary text-primary-foreground font-heading text-xs px-4 py-2 flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          ADD FRIEND
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-8">
        {(["all", "online", "in-game"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-heading text-xs px-4 py-2 border ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border"
            }`}
          >
            {f.toUpperCase().replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Friends List - full-screen blocks */}
      <div className="flex flex-col gap-2">
        {filtered.map((friend) => (
          <div
            key={friend.id}
            className="bg-card border border-border p-5 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-secondary flex items-center justify-center font-heading text-sm text-foreground">
                  {friend.avatar}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${statusColor(friend.status)} border-2 border-card`} />
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-foreground">
                  {friend.name}
                </h3>
                {friend.status === "in-game" && friend.currentGame ? (
                  <p className="font-body text-xs text-accent flex items-center gap-1">
                    <Gamepad2 className="h-3 w-3" />
                    Playing {friend.currentGame}
                  </p>
                ) : (
                  <p className="font-body text-xs text-muted-foreground">
                    {friend.status === "online" ? "Online" : "Offline"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="bg-secondary text-foreground p-2">
                <MessageSquare className="h-4 w-4" />
              </button>
              {friend.status === "in-game" && (
                <button className="bg-accent text-accent-foreground font-heading text-xs px-4 py-2">
                  JOIN
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Friend Requests */}
      <h2 className="font-heading text-lg font-bold text-foreground mt-10 mb-4">
        FRIEND REQUESTS
        <span className="ml-2 bg-accent text-accent-foreground font-heading text-xs px-2 py-1">
          2
        </span>
      </h2>
      <div className="flex flex-col gap-2">
        {[{ name: "STAR_PILOT", avatar: "SP" }, { name: "QUANTUM_FOX", avatar: "QF" }].map((req) => (
          <div key={req.name} className="bg-card border border-border p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary flex items-center justify-center font-heading text-sm text-foreground">
                {req.avatar}
              </div>
              <h3 className="font-heading text-sm font-bold text-foreground">{req.name}</h3>
            </div>
            <div className="flex gap-2">
              <button className="bg-primary text-primary-foreground font-heading text-xs px-4 py-2">
                ACCEPT
              </button>
              <button className="bg-secondary text-muted-foreground font-heading text-xs px-4 py-2">
                DECLINE
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

export default Friends;
