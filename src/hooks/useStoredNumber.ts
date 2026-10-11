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

/** Boolean version — used for preferences such as "show tool tips". */
export function useStoredFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [key, value]);

  const set = useCallback((v: boolean) => setValue(v), []);
  return [value, set];
}
