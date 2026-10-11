// BuildProgress.tsx — the Unity-style "asset import / compile" progress window
// shown while a game is being built (e.g. when saving a draft). A named-stage
// checklist, a log line, a percentage and an indeterminate scan bar while the
// work runs, collapsing to a green "done" state when the build completes.
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Check, Hammer, Loader2 } from "lucide-react";
import { buildDone, buildSteps, buildTitle, type BuildMode } from "@/lib/buildSteps";

const DURATION = 1500;

interface Props {
  active: boolean;
  complete: boolean;
  mode: BuildMode;
}

export function BuildProgress({ active, complete, mode }: Props) {
  const [mounted, setMounted] = useState(active);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const steps = useMemo(() => buildSteps(mode), [mode]);

  // Keep mounted briefly after `active` flips off so it can fade out.
  useEffect(() => {
    if (active) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), 280);
    return () => window.clearTimeout(t);
  }, [active]);

  // Reset the clock each time a build starts.
  useEffect(() => {
    if (!active) return;
    startRef.current = Date.now();
    setProgress(0);
    setElapsed(0);
  }, [active]);

  // Advance toward 90% while running; snap to 100% when complete.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      const t = Date.now() - (startRef.current || Date.now());
      setElapsed(t);
      const target = complete ? 100 : 90;
      setProgress((prev) => Math.min(target, Math.max(prev, (t / DURATION) * 100)));
    }, 60);
    return () => window.clearInterval(id);
  }, [active, complete]);

  useEffect(() => {
    if (complete) setProgress(100);
  }, [complete]);

  if (!mounted) return null;

  const done = complete;
  const stepIndex = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));

  return (
    <div
      data-testid="studio-build"
      className={`fixed inset-0 z-[95] flex items-center justify-center bg-black/55 transition-opacity duration-200 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="w-[470px] max-w-[92vw] overflow-hidden rounded-lg border border-[#3d3d3d] bg-[#2b2b2b] font-body text-[11px] text-[#d6d6d6] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#3d3d3d] bg-[#303030] px-3 py-2">
          {done ? (
            <Check className="h-4 w-4 text-[#7bd88f]" />
          ) : (
            <Hammer className="h-4 w-4 text-[#5a85c6]" />
          )}
          <span className="font-heading text-[12px] font-semibold">NexPlay Studio</span>
          <span className="ml-auto text-[10px] text-[#8f8f8f]">
            {done ? "Build finished" : buildTitle(mode)}
          </span>
        </div>

        <div className="px-4 py-3">
          <div className="mb-3 flex items-center gap-3">
            {done ? (
              <Check className="h-5 w-5 shrink-0 text-[#7bd88f]" />
            ) : (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#5a85c6]" />
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="truncate text-[11px] text-[#e0e0e0]">
                  {done ? buildDone(mode) : `${steps[stepIndex].label}…`}
                </span>
                <span className="ml-3 shrink-0 font-mono text-[10px] text-[#8f8f8f]">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-[#1d1d1d]">
                <div
                  className={`h-full rounded-full ${
                    done
                      ? "bg-[#4fae63]"
                      : "bg-gradient-to-r from-[#4772b3] via-[#5a85c6] to-[#7bd88f]"
                  }`}
                  style={{ width: `${progress}%`, transition: "width 0.12s linear" }}
                />
                {!done && (
                  <div className="build-scan pointer-events-none absolute inset-y-0 w-1/3 bg-white/10" />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1 rounded-[4px] border border-[#3a3a3a] bg-[#212121] p-2 font-mono text-[10px] text-[#9a9a9a]">
            {steps.map((s, i) => (
              <div key={s.label} className={`flex items-center gap-2 ${i > stepIndex ? "opacity-40" : ""}`}>
                {i < stepIndex || done ? (
                  <Check className="h-3 w-3 shrink-0 text-[#4fae63]" />
                ) : i === stepIndex && !done ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#5a85c6]" />
                ) : (
                  <Box className="h-3 w-3 shrink-0 text-[#5a5a5a]" />
                )}
                <span className="truncate">{s.label}</span>
                <span className="ml-auto shrink-0 truncate text-[#6f6f6f]">
                  {i <= stepIndex || done ? s.detail : ""}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 truncate font-mono text-[9px] text-[#6f6f6f]">
            AssetDatabase.Refresh() · {(elapsed / 1000).toFixed(1)}s · nexstudio/{mode}
          </div>
        </div>
      </div>
    </div>
  );
}
