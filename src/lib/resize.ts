// resize.ts — pure math for the draggable panel grips.

/** Clamp a panel size after a drag, optionally inverting the drag direction. */
export function resizeValue(
  startSize: number,
  delta: number,
  opts: { min: number; max: number; invert?: boolean },
): number {
  const d = opts.invert ? -delta : delta;
  return Math.round(Math.min(opts.max, Math.max(opts.min, startSize + d)));
}
