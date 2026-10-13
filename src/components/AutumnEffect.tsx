import { useMemo } from "react";
import { Leaf } from "lucide-react";
import { buildLeaves, prefersReducedMotion } from "@/lib/seasonalEvents";
import { AUTUMN_EVENT } from "@/lib/seasonalEvents";

const LEAF_PATHS = [
  // maple-ish
  "M12 2c2.4 2.2 3.2 5 2.2 7.4 2.6.4 4.4 2 5.4 4.4-2.8.6-4.4 2-5.4 4 .8 2.6-.2 5.2-2.6 7.2l-1.6-1.4c1.8-1.6 2.4-3.2 1.8-5-1.6-1.4-3.8-1.6-5.8-.6-.2-2.2-1.4-4-3.4-5.4 1.6-2.2 1.4-4.8-.6-7 2.6-.2 4.6-1.4 6-3.6 1.4 2.2 3.4 3.4 6 3.6z",
  // oval
  "M12 3c5 2 8 5 8 9s-3 7-8 9c-5-2-8-5-8-9s3-7 8-9zm0 2.4c-3.4 1.6-5.6 4-5.6 6.6S8.6 17 12 18.6c3.4-1.6 5.6-4 5.6-6.6S15.4 7 12 5.4z",
  // pointed
  "M12 1.5c4.5 4 7 7.6 7 11.2 0 4.4-3.1 8.3-7 9.8-3.9-1.5-7-5.4-7-9.8C5 9.1 7.5 5.5 12 1.5zm0 3.6c-2.6 2.4-4.2 5-4.2 7.6 0 2.8 1.8 5.3 4.2 6.6 2.4-1.3 4.2-3.8 4.2-6.6 0-2.6-1.6-5.2-4.2-7.6z",
];

interface AutumnEffectProps {
  count?: number;
  seed?: number;
  reducedMotion?: boolean;
}

export function AutumnEffect({ count = 18, seed = 7, reducedMotion }: AutumnEffectProps) {
  const isReduced = reducedMotion ?? prefersReducedMotion();
  const field = useMemo(() => buildLeaves(count, AUTUMN_EVENT.palette.leaf, seed), [count, seed]);

  if (isReduced) return null;

  return (
    <div className="leaf-layer" aria-hidden="true">
      {field.map((leaf, i) => (
        <span
          key={i}
          className="leaf"
          style={{
            left: `${leaf.left}%`,
            animationDelay: `${leaf.delay}s`,
            animationDuration: `${leaf.duration}s`,
            transform: `scale(${leaf.scale})`,
            ["--leaf-drift" as string]: `${leaf.drift}px`,
            ["--leaf-spin" as string]: `${leaf.spin}deg`,
            ["--leaf-size" as string]: `${12 + (leaf.scale - 0.6) * 8}px`,
          }}
        >
          <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ color: leaf.color }}>
            <path d={LEAF_PATHS[Math.floor(leaf.tone * LEAF_PATHS.length)]} fill="currentColor" opacity="0.9" />
          </svg>
        </span>
      ))}
    </div>
  );
}

export default AutumnEffect;
