import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";

/** Bottom-of-sidebar user chip: shows the signed-in player or a Sign In link. */
export function UserFooter({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { user, profile } = useAuth();

  const row = collapsed ? "md:justify-center md:gap-0 md:px-2" : "gap-3";
  const label = collapsed ? "md:hidden" : "";

  if (!user) {
    return (
      <NavLink
        to="/login"
        title="Sign In"
        className={`flex items-center px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors ${row}`}
        onClick={onNavigate}
      >
        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center font-heading text-xs text-primary font-bold shrink-0">
          ?
        </div>
        <span className={`font-body text-sm text-muted-foreground ${label}`}>Sign In</span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to="/profile"
      title={profile?.display_name || "Player"}
      className={`flex items-center px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors ${row}`}
      onClick={onNavigate}
    >
      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center font-heading text-xs text-primary font-bold shrink-0">
        {profile?.display_name?.[0]?.toUpperCase() || "?"}
      </div>
      <span className={`font-body text-sm text-muted-foreground truncate ${label}`}>
        {profile?.display_name || "Player"}
      </span>
    </NavLink>
  );
}
