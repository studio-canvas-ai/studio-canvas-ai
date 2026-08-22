import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl, getSupabaseConfigError } from "@/lib/supabase/config";
import {
  ensureSupabaseAuthStorageReady,
  getSupabaseAuthStorageKey,
} from "@/lib/supabase/authStorage";

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

  // Drop leftover sb-* keys/cookies from a previous Supabase project before init.
  const { ref } = ensureSupabaseAuthStorageReady();
  const storageKey = getSupabaseAuthStorageKey(ref);

  return createBrowserClient(url, key, {
    isSingleton: true,
    ...(storageKey
      ? {
          cookieOptions: {
            name: storageKey,
            path: "/",
            sameSite: "lax" as const,
          },
        }
      : {}),
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      ...(storageKey ? { storageKey } : {}),
    },
  });
}
