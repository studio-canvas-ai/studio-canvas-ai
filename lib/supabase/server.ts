import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl, getSupabaseConfigError } from "@/lib/supabase/config";
import { getSupabaseAuthStorageKey } from "@/lib/supabase/authStorage";

/** Server Supabase client bound to the current request cookies. */
export async function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      getSupabaseConfigError() ||
        "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)."
    );
  }

  const cookieStore = await cookies();
  const storageKey = getSupabaseAuthStorageKey();

  return createServerClient(url, key, {
    ...(storageKey
      ? {
          cookieOptions: {
            name: storageKey,
            path: "/",
            sameSite: "lax" as const,
          },
        }
      : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — middleware will refresh sessions.
        }
      },
    },
  });
}
