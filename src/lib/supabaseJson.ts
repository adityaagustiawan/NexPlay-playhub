import type { Json } from "@/integrations/supabase/types";

/**
 * Coerce a Supabase `Json` column value into a plain object record.
 * Non-object / array / null values become `{}` so callers can safely read keys.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Coerce a plain object record into a Supabase `Json` value for inserts/updates.
 * The `unknown` parameter keeps the assertion legal for any shaped payload.
 */
export function asJson(value: unknown): Json {
  return value as Json;
}
