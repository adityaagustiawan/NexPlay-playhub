// NodeEditor.tsx — a placeholder Shader/Compositor-style node editor.
// Lightweight scaffold; enough to expose the workspace for Scripting/Material
// workflows without pulling in a heavy graph library.
export function NodeEditor() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#282828] text-[11px] text-[#d0d0d0]">
      <div className="flex h-7 shrink-0 items-center border-b border-[#1d1d1d] bg-[#303030] px-3 font-heading uppercase tracking-wide text-[#b8b8b8]">
        Node Editor
      </div>
      <div className="flex flex-1 items-center justify-center text-[#8f8f8f]">
        Node Editor — Material / Compositor (placeholder)
      </div>
    </div>
  );
}