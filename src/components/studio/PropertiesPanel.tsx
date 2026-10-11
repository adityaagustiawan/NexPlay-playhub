// PropertiesPanel.tsx — Blender-style properties editor. A vertical strip of
// icon tabs on the left, the active tab's content on the right.
import type { ComponentType, ReactNode } from "react";

export interface PropTab {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface Props {
  tabs: PropTab[];
  active: string;
  onChange: (id: string) => void;
  children: ReactNode;
}

export function PropertiesPanel({ tabs, active, onChange, children }: Props) {
  const current = tabs.find((t) => t.id === active);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#303030]">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-[#1d1d1d] bg-[#303030] px-3 font-heading text-[11px] uppercase tracking-wide text-[#b8b8b8]">
        {current?.label ?? "Properties"}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-8 shrink-0 flex-col items-center gap-0.5 border-r border-[#1d1d1d] bg-[#282828] py-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                title={t.label}
                onClick={() => onChange(t.id)}
                className={`flex h-7 w-7 items-center justify-center rounded-[3px] ${
                  on ? "bg-[#4772b3] text-white" : "text-[#a0a0a0] hover:bg-[#3a3a3a]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}
