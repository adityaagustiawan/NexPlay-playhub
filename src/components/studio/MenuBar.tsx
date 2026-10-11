// MenuBar.tsx — a compact, Blender-style top menu bar for Nexstudio.
// A row of menu labels (File, Edit, ...) that open drop-downs. Deliberately
// chrome-light so the editor below can run fullscreen with just this taskbar.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

export interface MenuAction {
  label: string;
  onSelect?: () => void;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
}

export type MenuEntry = MenuAction | { separator: true };

export interface MenuDef {
  label: string;
  items: MenuEntry[];
}

function isSeparator(entry: MenuEntry): entry is { separator: true } {
  return (entry as { separator?: boolean }).separator === true;
}

interface MenuBarProps {
  menus: MenuDef[];
  brand?: ReactNode;
  right?: ReactNode;
}

export function MenuBar({ menus, brand, right }: MenuBarProps) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative z-40 h-9 shrink-0 flex items-center gap-0.5 px-2 border-b border-border bg-sidebar text-foreground select-none"
    >
      {brand && (
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-border/60 h-full">
          {brand}
        </div>
      )}
      {menus.map((menu, i) => (
        <div key={menu.label} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => (o === i ? null : i))}
            onMouseEnter={() => setOpen((o) => (o === null ? o : i))}
            className={`h-7 px-2.5 rounded text-xs font-body transition-colors ${
              open === i ? "bg-secondary text-foreground" : "text-foreground/80 hover:bg-secondary/60"
            }`}
          >
            {menu.label}
          </button>
          {open === i && (
            <div className="absolute left-0 top-full mt-0.5 min-w-[230px] rounded-md border border-border bg-popover text-popover-foreground shadow-xl py-1">
              {menu.items.map((item, j) =>
                isSeparator(item) ? (
                  <div key={`sep-${j}`} className="my-1 h-px bg-border" />
                ) : (
                  <button
                    key={`${item.label}-${j}`}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(null);
                      item.onSelect?.();
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-body text-left ${
                      item.disabled ? "opacity-40 cursor-default" : "hover:bg-secondary/70"
                    }`}
                  >
                    <span className="w-3 shrink-0">
                      {item.checked ? <Check className="h-3 w-3 text-primary" /> : null}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.shortcut && (
                      <span className="text-[10px] text-muted-foreground">{item.shortcut}</span>
                    )}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
      <div className="ml-auto flex items-center gap-2 pr-1">{right}</div>
    </div>
  );
}
