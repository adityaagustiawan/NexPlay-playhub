import { Search, Bell, Users, MessageSquare, Menu, Gamepad2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";

interface TopBarProps {
  onMenuToggle?: () => void;
  /** Mirrors the desktop sidebar auto-expand so the bar always abuts it. */
  sidebarExpanded?: boolean;
}

export function TopBar({ onMenuToggle, sidebarExpanded }: TopBarProps) {
  const { user, profile } = useAuth();

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-14 bg-sidebar/80 backdrop-blur-xl border-b border-border z-40 flex items-center px-4 md:px-6 gap-3 transition-[left] duration-200 ${
        sidebarExpanded ? "md:left-[220px]" : "md:left-[72px]"
      }`}
    >
      {/* Hamburger — mobile only */}
      <button onClick={onMenuToggle} className="md:hidden p-2 text-muted-foreground hover:text-foreground">
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo — mobile only */}
      <span className="md:hidden flex items-center gap-1.5 font-heading text-lg font-bold text-foreground">
        <Gamepad2 className="h-5 w-5 text-primary" />
        <span>
          <span className="text-primary">NEX</span>CONSOLE
        </span>
      </span>

      {/* Search */}
      <div className="hidden sm:flex items-center bg-secondary rounded-lg px-3 py-2 flex-1 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground mr-2" />
        <input
          type="text"
          placeholder="Search games, creators..."
          className="bg-transparent font-body text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
        />
      </div>

      <div className="flex-1" />

      {/* Right Actions */}
      <NavLink
        to="/friends"
        className="flex items-center gap-2 px-2 md:px-3 py-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
        activeClassName="text-foreground bg-secondary"
      >
        <Users className="h-5 w-5" />
        <span className="font-body text-sm hidden lg:inline">Friends</span>
      </NavLink>

      <button className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
        <MessageSquare className="h-5 w-5" />
      </button>

      <button className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
        <Bell className="h-5 w-5" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
      </button>

      {/* User avatar */}
      {user ? (
        <NavLink
          to="/profile"
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary transition-colors"
        >
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center font-heading text-xs text-primary font-bold">
            {profile?.display_name?.[0]?.toUpperCase() || "?"}
          </div>
        </NavLink>
      ) : (
        <NavLink
          to="/login"
          className="bg-primary text-primary-foreground font-heading text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          Sign In
        </NavLink>
      )}
    </header>
  );
}