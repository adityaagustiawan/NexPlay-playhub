import { Home, Compass, Sparkles, Coins, Plus } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const navItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Discover", url: "/explore", icon: Compass },
  { title: "Create", url: "/create", icon: Sparkles },
  { title: "Top Up", url: "/topup", icon: Coins },
];

export function AppSidebar() {
  return (
    <nav className="fixed left-0 top-0 h-screen w-[220px] bg-sidebar border-r border-border flex flex-col py-5 z-50">
      {/* Logo */}
      <div className="px-5 mb-6">
        <h1 className="font-heading text-xl font-bold text-foreground tracking-tight">
          <span className="text-primary">NEX</span>PLAY
        </h1>
      </div>

      {/* Create Button */}
      <div className="px-4 mb-6">
        <NavLink
          to="/create"
          className="flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-4 py-3 rounded-lg w-full justify-center hover:opacity-90 transition-opacity"
          activeClassName="opacity-90"
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
          >
            <item.icon className="h-5 w-5" />
            <span className="font-body text-sm font-medium">
              {item.title}
            </span>
          </NavLink>
        ))}
      </div>

      {/* User */}
      <div className="px-4 mt-auto">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center font-heading text-xs text-primary font-bold">
            ?
          </div>
          <span className="font-body text-sm text-muted-foreground">Sign In</span>
        </div>
      </div>
    </nav>
  );
}
