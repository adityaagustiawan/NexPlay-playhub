import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";

/** Bottom-of-sidebar user chip: shows the signed-in player or a Sign In link. */
export function UserFooter({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  /** Collapsed-rail mode: avatar only on desktop, label re-appears when expanded. */
  compact?: boolean;
}) {
  const { user, profile } = useAuth();

  const chipClassName = `flex items-center gap-3 rounded-lg py-2.5 hover:bg-secondary transition-colors ${
    compact ? "md:justify-center md:px-1" : "px-3"
  }`.trim();
  const labelClassName = `font-body text-sm text-muted-foreground truncate ${
    compact ? "md:hidden" : ""
  }`.trim();

  if (!user) {
    return (
      <NavLink to="/login" className={chipClassName} onClick={onNavigate}>
        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center font-heading text-xs text-primary font-bold">
          ?
        </div>
        <span className={labelClassName}>Sign In</span>
      </NavLink>
    );
  }

  return (
    <NavLink to="/profile" className={chipClassName} onClick={onNavigate}>
      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center font-heading text-xs text-primary font-bold">
        {profile?.display_name?.[0]?.toUpperCase() || "?"}
      </div>
      <span className={labelClassName}>{profile?.display_name || "Player"}</span>
    </NavLink>
  );
}