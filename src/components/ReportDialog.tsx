// ReportDialog — lets a signed-in player report another player. Writes straight
// to the `reports` table (RLS pins reporter_id to the caller); admins then see
// the report in the moderation dashboard.
import { useState } from "react";
import { Flag, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { REPORT_REASONS } from "@/lib/moderation";

interface ReportDialogProps {
  targetUserId: string;
  targetName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ targetUserId, targetName, open, onOpenChange }: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setReason(REPORT_REASONS[0]);
    setDetails("");
    setDone(false);
    setError(null);
    setBusy(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!user) {
      setError("You need to be signed in to report a player.");
      return;
    }
    if (user.id === targetUserId) {
      setError("You can't report yourself.");
      return;
    }
    setBusy(true);
    setError(null);

    const fullReason = details.trim() ? `${reason} — ${details.trim()}` : reason;
    const { error: insertError } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: targetUserId,
      reason: fullReason.slice(0, 500),
      status: "pending",
    });

    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDone(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            Report {targetName || "player"}
          </DialogTitle>
          <DialogDescription>
            Reports go to the moderators. False reports may be actioned too.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-6 flex flex-col items-center text-center gap-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-body text-sm text-foreground font-medium">Thanks — your report was sent.</p>
            <p className="font-body text-xs text-muted-foreground">
              A moderator will review it and may suspend or ban the player.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`w-full text-left font-body text-sm px-3 py-2 rounded-lg border transition-colors ${
                    reason === r
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <Textarea
              placeholder="Add any details (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />

            {error && <p className="font-body text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Flag className="h-4 w-4 mr-1" />}
                Send report
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReportButtonProps {
  targetUserId: string;
  targetName?: string;
  label?: string;
  className?: string;
}

/** A small ghost button that opens the report dialog. */
export function ReportButton({ targetUserId, targetName, label = "Report", className }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  // You can't report yourself.
  if (!user || user.id === targetUserId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-destructive transition-colors"
        }
      >
        <Flag className="h-3.5 w-3.5" />
        {label}
      </button>
      <ReportDialog
        targetUserId={targetUserId}
        targetName={targetName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
