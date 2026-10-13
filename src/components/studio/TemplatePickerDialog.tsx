// TemplatePickerDialog.tsx — File ▸ New Game from Template. A grid of 2D and
// 3D starters (inspired by Unity's project templates and Blender's start file),
// each stamping a config (+ 3D starter scene) into the studio.
import { Boxes } from "lucide-react";
import { TEMPLATES, type StudioTemplate } from "@/lib/templates";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (tpl: StudioTemplate) => void;
}

export function TemplatePickerDialog({ open, onClose, onPick }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 px-4 pt-20"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#3d3d3d] bg-[#232323] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#3d3d3d] px-4 py-3">
          <Boxes className="h-4 w-4 text-[#5a85c6]" />
          <h2 className="font-heading text-sm font-bold text-[#e8e8e8]">New game from template</h2>
          <p className="ml-auto font-body text-[11px] text-[#8f8f8f]">
            2D games make Canvas arcade runs · 3D games open in the Blender-style viewport
          </p>
        </div>
        <div className="grid max-h-[62vh] grid-cols-2 gap-2 overflow-y-auto p-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className="group flex flex-col gap-1 rounded-lg border border-[#3d3d3d] bg-[#2b2b2b] p-3 text-left transition-colors hover:border-[#4772b3] hover:bg-[#303030]"
            >
              <span className="flex items-center justify-between">
                <span className="font-heading text-[13px] font-semibold text-[#e0e0e0] group-hover:text-white">
                  {t.label}
                </span>
                <span
                  className={`rounded-[3px] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${
                    t.badge === "3D"
                      ? "bg-[#2d3a4b] text-[#7fb1e8]"
                      : "bg-[#2d4b33] text-[#8fd39b]"
                  }`}
                >
                  {t.badge}
                </span>
              </span>
              <span className="font-body text-[11px] leading-snug text-[#9a9a9a]">{t.blurb}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end border-t border-[#3d3d3d] px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[3px] border border-[#4a4a4a] px-3 py-1.5 text-[11px] text-[#d0d0d0] hover:bg-[#3a3a3a]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}