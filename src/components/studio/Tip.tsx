// Tip.tsx — a rich tool tip (name + description + shortcut) built on the Radix
// Tooltip primitive. Wraps any single element (a button) and shows a Blender-
// style hint. Can be globally disabled via `enabled` (Help ▸ Show tool tips).
import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  label: string;
  description?: string;
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  enabled?: boolean;
  children: ReactNode;
}

export function Tip({ label, description, shortcut, side = "right", enabled = true, children }: Props) {
  if (!enabled) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children as ReactElement}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        className="max-w-[240px] rounded-[4px] border border-[#4a4a4a] bg-[#232323] px-2.5 py-1.5 font-body text-[11px] text-[#e6e6e6] shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-heading text-[11px] font-semibold text-[#f0f0f0]">{label}</span>
          {shortcut ? (
            <span className="shrink-0 rounded-[3px] border border-[#4a4a4a] bg-[#1a1a1a] px-1 py-px font-mono text-[9px] text-[#9a9a9a]">
              {shortcut}
            </span>
          ) : null}
        </div>
        {description ? <p className="mt-1 leading-snug text-[#a8a8a8]">{description}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}
