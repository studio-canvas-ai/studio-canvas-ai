import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl, getSupabaseConfigError } from "@/lib/supabase/config";

/** Browser Supabase client (PKCE cookies via @supabase/ssr). */
export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      getSupabaseConfigError() ||
        "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)."
    );
  }
  return createBrowserClient(url, key);
}
