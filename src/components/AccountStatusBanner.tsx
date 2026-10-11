import { ShieldAlert, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatRemaining } from "@/lib/moderation";

/**
 * A persistent notice shown across the app when the signed-in account is
 * banned or suspended. Suspensions count down; bans explain the reason.
 */
export function AccountStatusBanner() {
  const { isBlocked, blockKind, suspendedUntil, profile } = useAuth();

  if (!isBlocked || !blockKind) return null;

  const isBan = blockKind === "banned";
  const reason = isBan ? profile?.banned_reason : profile?.suspended_reason;

  return (
    <div
      role="alert"
      className="border-b border-destructive/40 bg-destructive/10 px-4 py-3 flex items-start gap-3"
    >
      {isBan ? (
        <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      ) : (
        <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      )}
      <div className="font-body text-sm">
        <p className="font-semibold text-foreground">
          {isBan
            ? "Your account has been banned."
            : `Your account is suspended${
                suspendedUntil ? ` for another ${formatRemaining(suspendedUntil)}` : ""
              }.`}
        </p>
        <p className="text-muted-foreground">
          {reason || (isBan ? "Contact support if you believe this is a mistake." : "Play and creation are paused until the suspension ends.")}
        </p>
      </div>
    </div>
  );
}
