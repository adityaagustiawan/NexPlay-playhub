import { Home, Compass, Sparkles, Coins, Plus, X, Gamepad2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { UserFooter } from "@/components/UserFooter";

const navItems = [
  { title: "Home", url: "/library", icon: Home },
  { title: "Discover", url: "/explore", icon: Compass },
  { title: "Create", url: "/create", icon: Sparkles },
  { title: "Top Up", url: "/topup", icon: Coins },
];

interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
  /**
   * Desktop auto-expand state: false → the sidebar collapses to a compact logo
   * rail at the left edge. It is driven by cursor position (see AppLayout), so
   * it stays out of the way while playing/reading.
   */
  expanded?: boolean;
}

export function AppSidebar({ open, onClose, expanded = true }: AppSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
      )}

      <nav
        className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-border flex flex-col py-5 z-50 overflow-hidden
          transition-[transform,width] duration-200
          w-[220px] ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:w-[72px] ${expanded ? "md:w-[220px]" : "md:w-[72px]"}`}
      >
        {/* Logo + close on mobile */}
        <div className={`mb-6 flex items-center px-5 justify-between ${expanded ? "" : "md:justify-center md:px-0"}`}>
          <h1 className="font-heading text-xl font-bold text-foreground tracking-tight flex items-center gap-2 whitespace-nowrap">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <span className={expanded ? "inline" : "md:hidden"}>
              <span className="text-primary">NEX</span>CONSOLE
            </span>
          </h1>
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Create Button */}
        <div className={`mb-6 ${expanded ? "px-4" : "md:px-1"}`}>
          <NavLink
            to="/create"
            className={`flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity ${
              expanded
                ? "w-full justify-center px-4 py-3"
                : "w-full justify-center px-4 py-3 md:w-12 md:h-12 md:mx-auto md:px-0"
            }`}
            activeClassName="opacity-90"
            onClick={onClose}
          >
            <Plus className="h-4 w-4" />
            <span className={expanded ? "inline" : "md:hidden"}>Create</span>
          </NavLink>
        </div>

        {/* Nav Items */}
        <div className={`flex flex-col gap-1 flex-1 ${expanded ? "px-3" : "md:px-1"}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/library"}
              className={`flex items-center gap-3 px-3 py-2.5 text-muted-foreground rounded-lg hover:bg-secondary transition-colors ${
                expanded ? "" : "md:justify-center md:px-0"
              }`}
              activeClassName="bg-secondary text-foreground"
              onClick={onClose}
            >
              <item.icon className="h-5 w-5" />
              <span className={`font-body text-sm font-medium ${expanded ? "inline" : "md:hidden"}`}>
                {item.title}
              </span>
            </NavLink>
          ))}
        </div>

        {/* User */}
        <div className={`mt-auto ${expanded ? "px-4" : "md:px-1"}`}>
          <UserFooter onNavigate={onClose} compact={!expanded} />
        </div>
      </nav>
    </>
  );
}