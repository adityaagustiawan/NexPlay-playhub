// Vercel function: /api/generate-game
// The NexCode brain. Accepts a natural-language game idea from an authenticated
// player, checks it against the hard safety policy, then streams a terminal-style
// build log and finally the generated game config.
//
//   POST { "prompt": "a neon racer collecting energy cores" }
//   Authorization: Bearer <access token>
//   Accept: application/x-ndjson   -> newline-delimited JSON events (streaming)
//   (without the Accept header -> a single JSON response)
//
// NexCode can ONLY build games. Prompts that try to reach secrets, the backend,
// destructive actions, other users, or to override instructions are refused and
// the run is cancelled before any generation happens.
import { checkPrompt } from "../lib/server/policy.js";
import { generateGame, generateLocal } from "../lib/server/generator.js";
import { verifyGame } from "../lib/server/verify.js";
import { getAdminClient } from "../lib/server/admin.js";
import { getTopExamples, toFewShot, recordGeneration } from "../lib/server/learning.js";

export const config = { runtime: "nodejs" } as const;

export async function GET(): Promise<Response> {
  return json({ error: "Method not allowed" }, 405);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request): Promise<Response> {
  // 1) Authentication is required before anything runs.
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Missing access token" }, 401);
  }

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  const url = new URL(request.url);
  const wantsStream =
    (request.headers.get("accept") || "").includes("application/x-ndjson") ||
    url.searchParams.get("stream") === "1";

  // 2) Resolve the player from their JWT.
  let admin;
  try {
    admin = getAdminClient();
  } catch {
    return json({ error: "SERVER_NOT_CONFIGURED" }, 503);
  }
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ error: "Invalid session" }, 401);
  }

  // 3) Safety policy — evaluated on the server, always, before generation.
  const verdict = checkPrompt(prompt);

  // Non-streaming callers get a single JSON payload.
  if (!wantsStream) {
    if (!verdict.allowed) {
      return json({ blocked: true, category: verdict.category, reason: verdict.reason, message: verdict.warning }, 200);
    }
    const references = await buildReferences(prompt);
    const game = await generateGame(prompt, references);
    const generationId = await recordGeneration({ userId: userData.user.id, prompt, game });
    return json({ game, generationId }, 200);
  }

  // 4) Stream a terminal-style build log.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      const say = async (text: string, level: string = "info", ms = 280) => {
        send({ type: "line", level, text });
        await sleep(ms);
      };

      try {
        await say("NexCode v1.0 — constrained AI game builder", "sys", 160);
        await say("scope: games only · no backend access · no destructive actions", "dim", 220);
        await say(`> ${prompt}`, "prompt", 320);
        await say("Running safety policy…", "info", 380);

        if (!verdict.allowed) {
          send({ type: "warning", category: verdict.category, text: verdict.warning });
          await say("Request cancelled. Nothing was generated.", "error", 120);
          send({ type: "blocked", category: verdict.category, reason: verdict.reason, message: verdict.warning });
          controller.close();
          closed = true;
          return;
        }

        await say("Policy OK — request is in scope (game creation).", "ok", 240);
        await say("Analyzing your idea…", "info", 420);
        await say("Choosing a genre and theme…", "info", 420);
        await say("Scaffolding the scene…", "info", 420);

        const references = await buildReferences(prompt);
        if (references) {
          const n = references.split("\n").length;
          await say(`Learning from ${n} highly-rated past game${n === 1 ? "" : "s"}…`, "dim", 260);
        }

        let game = await generateGame(prompt, references);

        await say(`Assembling “${game.title}”…`, "info", 360);
        await say("Compiling gameplay config…", "info", 340);

        // --- Self-check: the AI verifies its own game before handing it over ---
        await say("Verifying the game…", "info", 320);
        let verify = verifyGame(game);
        if (!verify.ok) {
          // If the model produced something unplayable, fall back to the
          // deterministic generator and re-verify.
          game = generateLocal(prompt);
          verify = verifyGame(game);
        }
        for (const check of verify.checks) {
          send({
            type: "line",
            level: check.ok ? "ok" : "warning",
            text: `${check.ok ? "✔" : "✖"} check ${check.name}: ${check.detail}`,
          });
          await sleep(200);
        }

        if (!verify.ok) {
          send({
            type: "warning",
            text: "NexCode could not verify this game as playable, so it was discarded. Try rewording your idea.",
          });
          await say("Run aborted — unverified game discarded.", "error", 120);
          controller.close();
          closed = true;
          return;
        }

        game.assets = { ...game.assets, verified: true, verifiedAt: new Date().toISOString() };

        await say("Packaging your game…", "info", 300);

        const generationId = await recordGeneration({ userId: userData.user.id, prompt, game });
        send({ type: "result", game, generationId });
        await say("Done — verified and ready. Press Play.", "ok", 60);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Build the "learned from" reference block for a prompt: detect the likely
 * mode with the deterministic generator, then pull the best-rated similar
 * past games. Never throws (getTopExamples swallows errors).
 */
async function buildReferences(prompt: string): Promise<string> {
  const preview = generateLocal(prompt);
  const examples = await getTopExamples(prompt, preview.gameplay.mode, 4);
  return toFewShot(examples);
}
