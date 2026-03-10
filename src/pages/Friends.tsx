import { AppLayout } from "@/components/AppLayout";
import { UserPlus, Search, Users, UserCheck } from "lucide-react";
import { useState } from "react";

const Friends = () => {
  const [tab, setTab] = useState<"friends" | "requests" | "find">("friends");

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Friends</h1>
        <button className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity">
          <UserPlus className="h-4 w-4" />
          Add Friend
        </button>
      </div>

      {/* Tabs — Roblox style */}
      <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1 w-fit">
        {([
          { key: "friends", label: "Friends", icon: Users },
          { key: "requests", label: "Requests", icon: UserCheck },
          { key: "find", label: "Find Friends", icon: Search },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 font-body text-sm px-4 py-2 rounded-md transition-colors ${
              tab === t.key
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab === "find" && (
        <div className="flex items-center bg-card border border-border rounded-lg px-4 py-3 mb-6 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground mr-3" />
          <input
            type="text"
            placeholder="Search by username..."
            className="bg-transparent font-body text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
          />
        </div>
      )}

      {/* Empty State */}
      <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-heading text-base font-bold text-foreground mb-2">
          {tab === "friends" && "No friends yet"}
          {tab === "requests" && "No friend requests"}
          {tab === "find" && "Find players to connect with"}
        </h3>
        <p className="font-body text-sm text-muted-foreground text-center max-w-sm">
          {tab === "friends" && "Add friends to see what they're playing, join their games, and chat."}
          {tab === "requests" && "When someone sends you a friend request, it will appear here."}
          {tab === "find" && "Search for players by their username and send them a friend request."}
        </p>
      </div>
    </AppLayout>
  );
};

export default Friends;
