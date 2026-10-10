import { useEffect, useState } from "react";
import { Sparkles, Gamepad2, Play, Check, Loader2, RotateCcw } from "lucide-react";
import game1 from "@/assets/game-1.jpg";

const PROMPT =
  "A neon cyberpunk racer where you drift through a floating city and collect energy cores...";

const STEPS = [
  "Understanding your idea",
  "Writing game logic",
  "Generating sprites & world",
  "Testing physics",
  "Packaging your game",
];

type Phase = "idle" | "typing" | "generating" | "done";

/**
 * Animated showcase of the core NEXCONSOLE flow:
 * type a prompt → AI builds the game step by step → playable result appears.
 * Runs on a loop so visitors immediately see how creation works.
 */
export function PromptDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const [stepIndex, setStepIndex] = useState(-1);
  const [progress, setProgress] = useState(0);

  // Loop driver: idle → typing → generating → done → back to typing
  useEffect(() => {
    if (phase === "idle") {
      const id = window.setTimeout(() => setPhase("typing"), 900);
      return () => window.clearTimeout(id);
    }
    if (phase === "done") {
      const id = window.setTimeout(() => setPhase("typing"), 6000);
      return () => window.clearTimeout(id);
    }
  }, [phase]);

  // Typewriter
  useEffect(() => {
    if (phase !== "typing") return;
    setTyped("");
    setStepIndex(-1);
    setProgress(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(PROMPT.slice(0, i));
      if (i >= PROMPT.length) {
        window.clearInterval(id);
        setPhase("generating");
      }
    }, 26);
    return () => window.clearInterval(id);
  }, [phase]);

  // Generation steps + progress
  useEffect(() => {
    if (phase !== "generating") return;
    setStepIndex(0);
    setProgress(0);
    const stepTimers = STEPS.map((_, idx) =>
      window.setTimeout(() => setStepIndex(idx), idx * 520),
    );
    const progTimer = window.setInterval(
      () => setProgress((p) => Math.min(98, p + 4)),
      90,
    );
    const finish = window.setTimeout(() => {
      window.clearInterval(progTimer);
      setProgress(100);
      setPhase("done");
    }, STEPS.length * 520 + 500);
    return () => {
      window.clearInterval(progTimer);
      stepTimers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(finish);
    };
  }, [phase]);

  const restart = () => setPhase("typing");
  const showCaret = phase === "typing" || phase === "idle";
  const isDone = phase === "done";

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-primary/10">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/50">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-3 font-heading text-xs text-muted-foreground">
          nexconsole · AI Game Builder
        </span>
        {isDone && (
          <button
            onClick={restart}
            className="ml-auto flex items-center gap-1 font-body text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Replay
          </button>
        )}
      </div>

      <div className="grid gap-0 md:grid-cols-2">
        {/* Left: prompt + build log */}
        <div className="p-5 md:border-r border-border">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-heading text-sm font-semibold text-foreground">
              Describe your game
            </span>
          </div>

          <div className="relative min-h-[92px] bg-secondary rounded-lg p-3 font-body text-sm text-foreground">
            <span>{typed}</span>
            {showCaret && (
              <span className="caret-blink inline-block w-[2px] h-4 align-middle bg-primary ml-0.5" />
            )}
            {!typed && !showCaret && (
              <span className="text-muted-foreground">Your idea appears here…</span>
            )}
          </div>

          <div className="mt-4 space-y-2 min-h-[132px]">
            {STEPS.map((step, idx) => {
              const active = phase === "generating" && idx === stepIndex;
              const revealed = stepIndex >= idx || isDone;
              if (!revealed) return null;
              return (
                <div
                  key={step}
                  className={`step-in flex items-center gap-2 font-body text-xs ${
                    idx === stepIndex && !isDone
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {idx < stepIndex || isDone ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )}
                  {step}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden relative">
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-150 ease-out"
                style={{ width: `${phase === "idle" || phase === "typing" ? 0 : progress}%` }}
              />
              {phase === "generating" && (
                <span className="shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary-glow/60 to-transparent" />
              )}
            </div>
            <p className="font-body text-[11px] text-muted-foreground mt-1.5">
              {phase === "generating"
                ? `Jabali AI is building… ${progress}%`
                : isDone
                  ? "Your game is ready to play"
                  : "Waiting for your prompt"}
            </p>
          </div>
        </div>

        {/* Right: live preview */}
        <div className="p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <span className="font-heading text-sm font-semibold text-foreground">
              Live preview
            </span>
          </div>

          <div className="relative flex-1 min-h-[240px] rounded-xl overflow-hidden border border-border bg-secondary">
            {isDone ? (
              <div className="game-pop absolute inset-0">
                <img
                  src={game1}
                  alt="Neon Drift — AI generated game"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="font-heading text-lg font-bold text-foreground">
                    Neon Drift
                  </h3>
                  <p className="font-body text-xs text-muted-foreground mb-3">
                    Generated from your prompt in 12 seconds
                  </p>
                  <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-heading text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
                    <Play className="h-4 w-4" /> Play Now
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                <div
                  className={`h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center ${
                    phase === "generating" ? "animate-pulse" : ""
                  }`}
                >
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="font-body text-xs text-muted-foreground max-w-[220px]">
                  {phase === "generating"
                    ? "Assembling scenes, physics and art…"
                    : "Your game preview will appear here"}
                </p>
                <div className="w-40 h-1 bg-background rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-[width] duration-150"
                    style={{ width: `${phase === "generating" ? progress : 8}%` }}
                  />
                  {phase === "generating" && (
                    <span className="shimmer absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary-glow/60 to-transparent" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}