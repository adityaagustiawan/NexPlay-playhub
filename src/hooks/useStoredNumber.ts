// useStoredNumber.ts — a number state hook persisted to localStorage, used for
// remembering panel sizes between sessions.
import { useCallback, useEffect, useState } from "react";

export function useStoredNumber(key: string, initial: number): [number, (n: number) => void] {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      const n = raw == null ? NaN : Number(raw);
      return Number.isFinite(n) ? n : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  const set = useCallback((n: number) => setValue(n), []);
  return [value, set];
}
