import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/config";

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Service-role key — server only. Never expose to the browser. */
export function getSupabaseServiceRoleKey(): string | undefined {
  const key = stripWrappingQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!key) return undefined;
  if (/^(your|xxx|replace|changeme)/i.test(key)) return undefined;
  if (key.length < 20) return undefined;
  return key;
}

/**
 * Admin / privileged Supabase client (bypasses RLS).
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not configured.
 */
export function createSupabaseServiceClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
