// Server-only Supabase client (service role). Never import this from client code.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getAdminClient() {
  if (!url || !key) {
    throw new Error("Server env missing: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isServerConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}