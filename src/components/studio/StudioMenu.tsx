// StudioMenu.tsx — a Blender-style drop-down menu built on Radix (already a
// dependency), so outside-click / Escape / keyboard behaviour comes for free.
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";

export interface StudioMenuItem {
  label: string;
  onSelect?: () => void;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
}

export type StudioMenuEntry = StudioMenuItem | { separator: true };

function isSeparator(entry: StudioMenuEntry): entry is { separator: true } {
  return (entry as { separator?: boolean }).separator === true;
}

const DEFAULT_TRIGGER =
  "flex h-full items-center rounded-[3px] px-2.5 text-[11px] text-[#d0d0d0] outline-none transition-colors hover:bg-[#3a3a3a] data-[state=open]:bg-[#4772b3] data-[state=open]:text-white";

interface Props {
  label: string;
  items: StudioMenuEntry[];
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}

export function StudioMenu({ label, items, triggerClassName, align = "start" }: Props) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={triggerClassName ?? DEFAULT_TRIGGER}>
          {label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={3}
          collisionPadding={8}
          className="z-[90] min-w-[220px] rounded-[4px] border border-[#4a4a4a] bg-[#2b2b2b] p-1 font-body text-[11px] text-[#d6d6d6] shadow-2xl outline-none"
        >
          {items.map((item, i) =>
            isSeparator(item) ? (
              <DropdownMenu.Separator key={`sep-${i}`} className="my-1 h-px bg-[#3d3d3d]" />
            ) : (
              <DropdownMenu.Item
                key={`${item.label}-${i}`}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className="flex cursor-default select-none items-center gap-2 rounded-[3px] px-2 py-1 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[#4772b3] data-[highlighted]:text-white"
              >
                <span className="flex w-3 shrink-0 justify-center">
                  {item.checked ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.shortcut ? <span className="text-[10px] text-[#8a8a8a]">{item.shortcut}</span> : null}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
