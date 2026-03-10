import { Library, Compass, Sparkles, Users, Coins } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const navItems = [
  { title: "LIBRARY", url: "/", icon: Library },
  { title: "EXPLORE", url: "/explore", icon: Compass },
  { title: "CREATE", url: "/create", icon: Sparkles },
  { title: "FRIENDS", url: "/friends", icon: Users },
  { title: "TOP UP", url: "/topup", icon: Coins },
];

export function AppSidebar() {
  return (
    <nav className="fixed left-0 top-0 h-screen w-20 bg-sidebar border-r border-border flex flex-col items-center py-6 z-50">
      <div className="mb-10">
        <h1 className="font-heading text-primary text-xs font-bold tracking-widest text-center leading-tight">
          ASTRO<br />CADE
        </h1>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className="flex flex-col items-center justify-center w-16 h-16 text-muted-foreground"
            activeClassName="bg-primary text-primary-foreground"
          >
            <item.icon className="h-5 w-5 mb-1" />
            <span className="font-heading text-[9px] font-medium tracking-wider">
              {item.title}
            </span>
          </NavLink>
        ))}
      </div>

      <div className="mt-auto">
        <div className="flex flex-col items-center text-muted-foreground">
          <div className="w-8 h-8 bg-secondary flex items-center justify-center font-heading text-xs text-foreground">
            JB
          </div>
        </div>
      </div>
    </nav>
  );
}
