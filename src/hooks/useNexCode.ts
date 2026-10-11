// useNexCode.ts — streams a game build from /api/generate-game into a log the
// NexCode terminal can render. Server-side safety blocks disallowed prompts and
// those arrive here as { type: "blocked" } / { type: "warning" } events.
import { useCallback, useRef, useState } from "react";

export type NexCodeLevel = "sys" | "dim" | "prompt" | "info" | "ok" | "warning" | "error";

export interface NexCodeLine {
  id: number;
  level: NexCodeLevel;
  text: string;
}

export interface GeneratedGame {
  title: string;
  description: string;
  gameplay: Record<string, unknown>;
  assets: Record<string, unknown>;
}

interface UseNexCode {
  lines: NexCodeLine[];
  running: boolean;
  blocked: string | null;
  error: string | null;
  generationId: string | null;
  clear: () => void;
  pushLine: (level: NexCodeLevel, text: string) => void;
  run: (prompt: string, token: string | null | undefined) => Promise<GeneratedGame | null>;
}

export function useNexCode(): UseNexCode {
  const [lines, setLines] = useState<NexCodeLine[]>([]);
  const [running, setRunning] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const idRef = useRef(0);

  const push = useCallback((level: NexCodeLevel, text: string) => {
    idRef.current += 1;
    setLines((prev) => [...prev, { id: idRef.current, level, text }]);
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setBlocked(null);
    setError(null);
    setGenerationId(null);
  }, []);

  const run = useCallback(
    async (prompt: string, token: string | null | undefined): Promise<GeneratedGame | null> => {
      setRunning(true);
      setBlocked(null);
      setError(null);
      setGenerationId(null);

      if (!token) {
        push("error", "You need to sign in before NexCode can build a game.");
        setRunning(false);
        return null;
      }

      try {
        const res = await fetch("/api/generate-game", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
            accept: "application/x-ndjson",
          },
          body: JSON.stringify({ prompt }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.message || data?.error || `NexCode request failed (${res.status})`;
          push("error", msg);
          setError(msg);
          setRunning(false);
          return null;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let game: GeneratedGame | null = null;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const line = chunk.trim();
            if (!line) continue;
            let evt: any;
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            if (evt.type === "line") push(evt.level as NexCodeLevel, evt.text);
            else if (evt.type === "warning") push("warning", evt.text);
            else if (evt.type === "blocked") {
              setBlocked(evt.message ?? "Request blocked.");
              push("error", "NexCode cancelled this request.");
            } else if (evt.type === "result") {
              game = evt.game as GeneratedGame;
              push("ok", `Built “${evt.game?.title}”.`);
            } else if (evt.type === "error") {
              push("error", evt.message);
              setError(evt.message);
            }
          }
        }

        setRunning(false);
        return game;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "NexCode could not be reached.";
        push("error", msg);
        setError(msg);
        setRunning(false);
        return null;
      }
    },
    [push]
  );

  return { lines, running, blocked, error, clear, pushLine: push, run };
}
