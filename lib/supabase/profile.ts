import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

export type ProfileUpsertInput = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  provider?: string | null;
  appUserId?: string | null;
};

/**
 * Upsert public.profiles using the signed-in user's access token (RLS-safe).
 * No-ops quietly if the table is missing or Supabase is not configured.
 */
export async function upsertProfileWithAccessToken(
  accessToken: string,
  input: ProfileUpsertInput
): Promise<void> {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon || !accessToken || !input.id) return;

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { error } = await supabase.from("profiles").upsert(
    {
      id: input.id,
      email: input.email ?? null,
      full_name: input.fullName ?? null,
      avatar_url: input.avatarUrl ?? null,
      provider: input.provider ?? null,
      app_user_id: input.appUserId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    // Table may not exist yet before SQL migration is applied — don't block login.
    console.warn("[supabase] profiles upsert skipped:", error.message);
  }
}
