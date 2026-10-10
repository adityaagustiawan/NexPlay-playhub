// Stable per-device identifier for the age agreement.
//
// The agreement must survive a hard refresh (and even clearing localStorage),
// so we do NOT rely on a random stored UUID. Instead we derive a fingerprint
// from stable browser/device characteristics and hash it. A device that
// accepted the terms as a minor keeps that protection on every reload.

const FINGERPRINT_VERSION = "nexd_v1";

let cached: string | null = null;

function safe(read: () => unknown, fallback = ""): string {
  try {
    const value = read();
    return value === undefined || value === null ? fallback : String(value);
  } catch {
    return fallback;
  }
}

function canvasSignature(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("NEXCONSOLE-fp", 2, 2);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("NEXCONSOLE-fp", 4, 8);
    return canvas.toDataURL();
  } catch {
    return "";
  }
}

function rawFingerprint(): string {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const scr = typeof screen !== "undefined" ? screen : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = nav as any;
  const parts = [
    safe(() => n?.userAgent),
    safe(() => n?.language),
    safe(() => (Array.isArray(n?.languages) ? n.languages.join(",") : "")),
    safe(() => n?.platform),
    safe(() => n?.hardwareConcurrency),
    safe(() => n?.deviceMemory),
    safe(() => n?.maxTouchPoints),
    safe(() => scr?.width),
    safe(() => scr?.height),
    safe(() => scr?.colorDepth),
    safe(() => (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : "")),
    safe(() => new Date().getTimezoneOffset()),
    safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    canvasSignature(),
  ];
  return parts.join("|");
}

async function sha256Hex(input: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/** Small non-cryptographic fallback when SubtleCrypto is unavailable. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Resolve (and memoize) the current device hash. */
export async function getDeviceHash(): Promise<string> {
  if (cached) return cached;
  const raw = rawFingerprint();
  const hex = (await sha256Hex(raw)) ?? fnv1a(raw);
  cached = `${FINGERPRINT_VERSION}_${hex.slice(0, 64)}`;
  return cached;
}
