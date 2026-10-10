import { cn } from "@/lib/utils";

/** Small "BETA" pill used across the UI while the platform is in testing. */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-accent/20 text-accent border border-accent/40 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider",
        className,
      )}
    >
      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent beta-pulse" />
      Beta
    </span>
  );
}