import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Refresh Supabase auth cookies on the response so PKCE sessions stay valid.
 * No-ops when Supabase env vars are missing.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  if (!isSupabaseConfigured()) return response;

  const url = getSupabaseUrl()!;
  const key = getSupabaseAnonKey()!;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Touches the session so expired tokens are refreshed into cookies.
  // Cap wait time — a hung Auth API must not freeze the whole site via middleware.
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 2500);
      }),
    ]);
  } catch {
    /* ignore refresh failures */
  }
  return response;
}
