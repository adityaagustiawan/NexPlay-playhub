import { useEffect, useState } from "react";
import {
  Home,
  Compass,
  Sparkles,
  Coins,
  Plus,
  X,
  Gamepad2,
  Wrench,
  Boxes,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { UserFooter } from "@/components/UserFooter";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { title: "Home", url: "/library", icon: Home },
  { title: "Discover", url: "/explore", icon: Compass },
  { title: "Create", url: "/create", icon: Sparkles },
  { title: "Top Up", url: "/topup", icon: Coins },
];

interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
  /** Desktop rail mode: logo/icons only, no words. Mobile drawer is always expanded. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AppSidebar({ open, onClose, collapsed = false, onToggleCollapse }: AppSidebarProps) {
  const { user } = useAuth();
  // When the rail is collapsed, hovering temporarily expands it as an overlay
  // ("peek") so labels are readable without pinning the sidebar open.
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    // Drop the peek if the sidebar is expanded (labels are already visible).
    if (!collapsed) setPeeking(false);
  }, [collapsed]);

  const railCollapsed = collapsed && !peeking;

  // Width: mobile drawer stays 220px; desktop switches between 220px and 72px.
  const navWidth = railCollapsed ? "w-[220px] md:w-[72px]" : "w-[220px] md:w-[220px]";
  // Hide text labels only when collapsed ON DESKTOP (md+), so the mobile drawer
  // still shows words.
  const label = railCollapsed ? "md:hidden" : "";
  const iconRow = railCollapsed ? "md:justify-center md:gap-0 md:px-2" : "gap-3";

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
      )}

      <nav
        onMouseEnter={() => collapsed && setPeeking(true)}
        onMouseLeave={() => setPeeking(false)}
        className={`fixed left-0 top-0 h-screen ${navWidth} bg-sidebar border-r border-border flex flex-col py-5 z-50 transition-[transform,width] duration-200
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Logo + controls */}
        <div
          className={`mb-6 flex items-center ${
            railCollapsed ? "px-4 md:flex-col md:justify-center md:gap-3 md:px-0" : "px-5 justify-between gap-2"
          }`}
        >
          <h1
            className="font-heading text-xl font-bold text-foreground tracking-tight flex items-center gap-2"
            title="NEXCONSOLE"
          >
            <Gamepad2 className="h-5 w-5 text-primary shrink-0" />
            <span className={label}>
              <span className="text-primary">NEX</span>CONSOLE
            </span>
          </h1>

          {/* Desktop collapse / expand toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* Close — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Create button */}
        <div className={`mb-6 ${railCollapsed ? "px-4 md:px-2" : "px-4"}`}>
          <NavLink
            to="/create"
            title="Create"
            className="flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-3 py-3 rounded-lg w-full justify-center hover:opacity-90 transition-opacity"
            activeClassName="opacity-90"
            onClick={onClose}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className={label}>Create</span>
          </NavLink>
        </div>

        {/* Nav items */}
        <div className={`flex flex-col gap-1 flex-1 ${railCollapsed ? "px-3 md:px-2" : "px-3"}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/library"}
              title={item.title}
              className={`flex items-center px-3 py-2.5 text-muted-foreground rounded-lg hover:bg-secondary transition-colors ${iconRow}`}
              activeClassName="bg-secondary text-foreground"
              onClick={onClose}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className={`font-body text-sm font-medium ${label}`}>{item.title}</span>
            </NavLink>
          ))}
          {user && (
            <NavLink
              to="/creator"
              title="Creator"
              className={`flex items-center px-3 py-2.5 text-muted-foreground rounded-lg hover:bg-secondary transition-colors ${iconRow}`}
              activeClassName="bg-secondary text-foreground"
              onClick={onClose}
            >
              <Wrench className="h-5 w-5 shrink-0" />
              <span className={`font-body text-sm font-medium ${label}`}>Creator</span>
            </NavLink>
          )}
        </div>

        {/* User */}
        <div className={`mt-auto ${railCollapsed ? "px-4 md:px-2" : "px-4"}`}>
          <UserFooter onNavigate={onClose} collapsed={railCollapsed} />
        </div>
      </nav>
    </>
  );
}
