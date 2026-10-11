// StudioIntro.tsx — the opening animation shown when the studio mounts. A
// branded NexPlay splash with a sweeping progress bar and rotating startup
// lines (in the spirit of Blender's splash / Unity's launch). On the first run
// it is longer and hands off to the "how to use" tour; afterwards it is a short
// flash. Skippable with any key or click.
import { useEffect, useRef, useState } from "react";
import { Check, Play, Sparkles } from "lucide-react";
import { introDuration } from "@/lib/onboarding";

const STEPS_FIRST = [
  "Booting NexPlay engine…",
  "Reading startup file…",
  "Loading workspaces & viewport…",
  "Warming up Muse AI…",
  "Welcome — ready to create.",
];

const STEPS_REPEAT = ["Booting NexPlay engine…", "Loading viewport…", "Ready."];

interface Props {
  firstRun: boolean;
  onDone: () => void;
}

export function StudioIntro({ firstRun, onDone }: Props) {
  const steps = firstRun ? STEPS_FIRST : STEPS_REPEAT;
  const total = introDuration(firstRun);
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    window.setTimeout(onDone, 300);
  };

  useEffect(() => {
    const per = total / steps.length;
    const timers = steps.slice(1).map((_, i) => window.setTimeout(() => setStep(i + 1), per * (i + 1)));
    const end = window.setTimeout(finish, total);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any key or click skips.
  useEffect(() => {
    window.addEventListener("keydown", finish);
    window.addEventListener("pointerdown", finish);
    return () => {
      window.removeEventListener("keydown", finish);
      window.removeEventListener("pointerdown", finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      data-testid="studio-intro"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#161616] ${
        leaving ? "animate-[intro-out_0.3s_ease-in_forwards]" : "animate-[intro-in_0.35s_ease-out]"
      }`}
    >
      <div className="intro-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      <div className="pointer-events-none absolute h-[440px] w-[440px] rounded-full bg-[#4772b3]/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 h-[320px] w-[520px] rounded-full bg-[#7bd88f]/10 blur-[100px]" />

      <div className="relative flex flex-col items-center">
        <div className="intro-logo flex h-16 w-16 items-center justify-center rounded-2xl bg-[#4772b3] shadow-[0_0_60px_rgba(71,114,179,0.55)]">
          <Play className="h-8 w-8 text-white" fill="currentColor" />
        </div>

        <h1 className="mt-5 font-heading text-2xl font-bold tracking-wide text-[#f2f2f2]">
          Nex<span className="text-[#5a85c6]">Play</span>{" "}
          <span className="font-normal text-[#8f8f8f]">Studio</span>
        </h1>
        <p className="mt-1 text-[11px] text-[#8f8f8f]">Blender-inspired game editor · Muse AI inside</p>

        <div className="mt-7 h-1 w-[280px] overflow-hidden rounded-full bg-[#2b2b2b]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4772b3] to-[#7bd88f]"
            style={{ animation: `intro-bar ${total}ms linear forwards` }}
          />
        </div>

        <div className="mt-3 flex h-5 items-center gap-2 text-[11px] text-[#b0b0b0]">
          {step >= steps.length - 1 ? (
            <Check className="h-3.5 w-3.5 text-[#7bd88f]" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-[#7bd88f]" />
          )}
          <span key={step} className="animate-[rise-in_0.3s_ease-out]">
            {steps[step]}
          </span>
        </div>

        <button
          type="button"
          data-testid="studio-intro-skip"
          onClick={(e) => {
            e.stopPropagation();
            finish();
          }}
          className="mt-8 rounded-[4px] border border-[#3a3a3a] px-3 py-1 text-[10px] text-[#8f8f8f] transition-colors hover:border-[#4772b3] hover:text-white"
        >
          Skip
        </button>
      </div>

      <span className="absolute bottom-5 text-[10px] text-[#5a5a5a]">Press any key to skip</span>
    </div>
  );
}
