import { Home, Compass, Sparkles, Coins, Plus, X, Gamepad2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { UserFooter } from "@/components/UserFooter";

const navItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Discover", url: "/explore", icon: Compass },
  { title: "Create", url: "/create", icon: Sparkles },
  { title: "Top Up", url: "/topup", icon: Coins },
];

interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
      )}

      <nav
        className={`fixed left-0 top-0 h-screen w-[220px] bg-sidebar border-r border-border flex flex-col py-5 z-50 transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Logo + close on mobile */}
        <div className="px-5 mb-6 flex items-center justify-between">
          <h1 className="font-heading text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <span>
              <span className="text-primary">NEX</span>CONSOLE
            </span>
          </h1>
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Create Button */}
        <div className="px-4 mb-6">
          <NavLink
            to="/create"
            className="flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-4 py-3 rounded-lg w-full justify-center hover:opacity-90 transition-opacity"
            activeClassName="opacity-90"
            onClick={onClose}
          >
            <Plus className="h-4 w-4" />
            Create
          </NavLink>
        </div>

        {/* Nav Items */}
        <div className="flex flex-col gap-1 px-3 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-3 px-3 py-2.5 text-muted-foreground rounded-lg hover:bg-secondary transition-colors"
              activeClassName="bg-secondary text-foreground"
              onClick={onClose}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-body text-sm font-medium">{item.title}</span>
            </NavLink>
          ))}
        </div>

        {/* User */}
        <div className="px-4 mt-auto">
          <UserFooter onNavigate={onClose} />
        </div>
      </nav>
    </>
  );
}
