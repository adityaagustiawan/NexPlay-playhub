import { Search, Bell, Users, MessageSquare } from "lucide-react";
import { NavLink } from "@/components/NavLink";

export function TopBar() {
  return (
    <header className="fixed top-0 left-[220px] right-0 h-14 bg-sidebar/80 backdrop-blur-xl border-b border-border z-40 flex items-center px-6 gap-4">
      {/* Search */}
      <div className="flex items-center bg-secondary rounded-lg px-3 py-2 flex-1 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground mr-2" />
        <input
          type="text"
          placeholder="Search games, creators..."
          className="bg-transparent font-body text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
        />
      </div>

      <div className="flex-1" />

      {/* Right Actions — Roblox-style */}
      <NavLink
        to="/friends"
        className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
        activeClassName="text-foreground bg-secondary"
      >
        <Users className="h-5 w-5" />
        <span className="font-body text-sm hidden md:inline">Friends</span>
      </NavLink>

      <button className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
        <MessageSquare className="h-5 w-5" />
      </button>

      <button className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
        <Bell className="h-5 w-5" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
      </button>
    </header>
  );
}
