// InfoPanel.tsx — Blender's Info bar area conceptually; shows last operator
// and context. Kept lightweight.
export function InfoPanel() {
  return (
    <div className="flex h-6 shrink-0 items-center gap-3 border-t border-black bg-[#303030] px-3 text-[11px] text-[#9a9a9a] select-none">
      <span>Info: Operator Search (F3) · Toggle Toolbar/Props (T/N) · Views (1/3/7/0) · Tab to toggle mode</span>
    </div>
  );
}