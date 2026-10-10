import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";

/** Bottom-of-sidebar user chip: shows the signed-in player or a Sign In link. */
export function UserFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile } = useAuth();

  if (!user) {
    return (
      <NavLink
        to="/login"
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
        onClick={onNavigate}
      >
        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center font-heading text-xs text-primary font-bold">
          ?
        </div>
        <span className="font-body text-sm text-muted-foreground">Sign In</span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to="/profile"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
      onClick={onNavigate}
    >
      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center font-heading text-xs text-primary font-bold">
        {profile?.display_name?.[0]?.toUpperCase() || "?"}
      </div>
      <span className="font-body text-sm text-muted-foreground truncate">
        {profile?.display_name || "Player"}
      </span>
    </NavLink>
  );
}