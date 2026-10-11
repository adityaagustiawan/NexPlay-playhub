// ScriptingEditor.tsx — a minimal text editor placeholder for scripting.
// Represents the Text Editor workspace area for now.
export function ScriptingEditor() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#1d1d1d] text-[11px] text-[#d0d0d0] select-none">
      <div className="flex h-7 shrink-0 items-center border-b border-[#1d1d1d] bg-[#303030] px-3 font-heading uppercase tracking-wide text-[#b8b8b8]">
        Text Editor
      </div>
      <div className="flex flex-1 items-center justify-center text-[#8f8f8f]">
        Text Editor — Scripting area (placeholder)
      </div>
    </div>
  );
}