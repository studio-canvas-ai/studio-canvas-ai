import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { mapSupabaseProviderToAuthId } from "@/lib/supabase/oauth";
import type { AuthProviderId, PlanId } from "@/lib/db/types";

/**
 * Verified public.profiles columns:
 * id, email, name, avatar_url, app_user_id, terms_agreed, terms_agreed_at, created_at
 */

/** App-facing upsert input (camelCase → snake_case columns below). */
export type ProfileUpsertInput = {
  id: string;
  email?: string | null;
  /** → profiles.name */
  name?: string | null;
  /** → profiles.avatar_url */
  avatarUrl?: string | null;
  /** → profiles.app_user_id */
  appUserId?: string | null;
};

/** Exact row shape for public.profiles. */
export type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  app_user_id: string | null;
  terms_agreed: boolean | null;
  terms_agreed_at: string | null;
  created_at: string | null;
};

/**
 * Columns written on upsert. Never includes provider / updated_at / full_name
 * (not present on the aligned table). created_at is left to DB default on insert.
 */
export type ProfileUpsertPayload = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  app_user_id: string | null;
  terms_agreed?: boolean;
  terms_agreed_at?: string;
};

export function resolveProfileDisplayName(
  input: Pick<ProfileUpsertInput, "name">
): string | null {
  if (typeof input.name !== "string") return null;
  const trimmed = input.name.trim();
  return trimmed.length ? trimmed : null;
}

/** Build upsert body using only verified profile column names. */
export function buildProfileUpsertPayload(
  input: ProfileUpsertInput,
  extras?: { termsAgreed?: true; termsAgreedAt?: string }
): ProfileUpsertPayload {
  const payload: ProfileUpsertPayload = {
    id: input.id,
    email: input.email ?? null,
    name: resolveProfileDisplayName(input),
    avatar_url: input.avatarUrl ?? null,
    app_user_id: input.appUserId ?? null,
  };
  if (extras?.termsAgreed) {
    const at = extras.termsAgreedAt ?? new Date().toISOString();
    payload.terms_agreed = true;
    payload.terms_agreed_at = at;
  }
  return payload;
}

function clientWithAccessToken(accessToken: string) {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon || !accessToken) return null;

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function isSchemaColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache")
  );
}

function isRlsViolationError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("row-level security") ||
    m.includes("violates row-level security") ||
    m.includes("42501") ||
    m.includes("permission denied")
  );
}

/**
 * Confirm the JWT subject matches the profile id we are about to write.
 * Prevents RLS failures from auth.uid() ≠ id mismatches.
 */
async function assertAccessTokenOwnsProfileId(
  accessToken: string,
  profileId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = clientWithAccessToken(accessToken);
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured" };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return { ok: false, error: error?.message || "Invalid access token" };
  }
  if (user.id !== profileId) {
    return {
      ok: false,
      error: "Profile id must equal auth.uid() (RLS)",
    };
  }
  return { ok: true };
}

/**
 * Upsert public.profiles (RLS-safe). Writes name, avatar_url, app_user_id.
 * Does not set terms_agreed. Requires auth.uid() = id.
 */
export async function upsertProfileWithAccessToken(
  accessToken: string,
  input: ProfileUpsertInput
): Promise<void> {
  if (!accessToken || !input.id) return;

  const ownership = await assertAccessTokenOwnsProfileId(accessToken, input.id);
  if (!ownership.ok) {
    console.warn("[supabase] profiles upsert skipped:", ownership.error);
    return;
  }

  const supabase = clientWithAccessToken(accessToken);
  if (!supabase) return;

  const { error } = await supabase
    .from("profiles")
    .upsert(buildProfileUpsertPayload(input), { onConflict: "id" });

  if (error) {
    console.warn("[supabase] profiles upsert skipped:", error.message);
  }
}

/** Read terms_agreed for the authenticated user. Missing row ⇒ false. */
export async function getTermsAgreedWithAccessToken(
  accessToken: string,
  userId: string
): Promise<boolean> {
  if (!accessToken || !userId) return false;

  const ownership = await assertAccessTokenOwnsProfileId(accessToken, userId);
  if (!ownership.ok) return false;

  const supabase = clientWithAccessToken(accessToken);
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("terms_agreed")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[supabase] terms_agreed read skipped:", error.message);
    return false;
  }

  return Boolean(data?.terms_agreed);
}

export type TermsAgreeInput = ProfileUpsertInput & {
  termsAgreed: true;
};

/**
 * Consent upsert — exact columns:
 * id, email, name, avatar_url, app_user_id, terms_agreed, terms_agreed_at
 * (created_at left to DB default on insert)
 */
export async function agreeToTermsWithAccessToken(
  accessToken: string,
  input: TermsAgreeInput
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  if (!accessToken || !input.id) {
    return { ok: false, error: "Supabase is not configured", code: "config" };
  }

  if (!/^[0-9a-f-]{36}$/i.test(input.id)) {
    return { ok: false, error: "Invalid user id", code: "invalid_id" };
  }

  const ownership = await assertAccessTokenOwnsProfileId(accessToken, input.id);
  if (!ownership.ok) {
    return { ok: false, error: ownership.error, code: "rls" };
  }

  const supabase = clientWithAccessToken(accessToken);
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured", code: "config" };
  }

  const now = new Date().toISOString();
  const payload = buildProfileUpsertPayload(input, {
    termsAgreed: true,
    termsAgreedAt: now,
  });

  // Upsert needs INSERT + UPDATE + SELECT policies for auth.uid() = id.
  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    if (isRlsViolationError(error.message)) {
      return {
        ok: false,
        code: "rls",
        error:
          "RLS blocked profile write — confirm policies allow SELECT/INSERT/UPDATE where auth.uid() = id",
      };
    }
    if (isSchemaColumnError(error.message)) {
      return {
        ok: false,
        code: "schema",
        error:
          "profiles schema mismatch — expected columns: id, email, name, avatar_url, app_user_id, terms_agreed, terms_agreed_at, created_at",
      };
    }
    return { ok: false, error: error.message, code: "upsert" };
  }
  return { ok: true };
}

export type AdminRegisteredUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  provider: AuthProviderId;
  planId: PlanId;
  credits: number;
  createdAt: number;
  termsAgreed: boolean;
  supabaseUserId: string;
  appUserId: string | null;
};

const PROFILE_ADMIN_SELECT =
  "id, email, name, avatar_url, app_user_id, terms_agreed, terms_agreed_at, created_at" as const;

/**
 * Admin directory: profiles where terms_agreed = true.
 * Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export async function listRegisteredProfilesForAdmin(): Promise<
  AdminRegisteredUser[]
> {
  const admin = createSupabaseServiceClient();
  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to list registered users from Supabase"
    );
  }

  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_ADMIN_SELECT)
    .eq("terms_agreed", true)
    .order("created_at", { ascending: false });

  if (error) {
    if (isSchemaColumnError(error.message)) {
      throw new Error(
        "profiles schema mismatch — expected columns: id, email, name, avatar_url, app_user_id, terms_agreed, terms_agreed_at, created_at"
      );
    }
    throw new Error(error.message);
  }

  return mapAdminRows((data ?? []) as ProfileRow[]);
}

async function mapAdminRows(rows: ProfileRow[]): Promise<AdminRegisteredUser[]> {
  const { getUserById } = await import("@/lib/db/credits");
  const mapped: AdminRegisteredUser[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);

    const appUserId =
      typeof row.app_user_id === "string" && row.app_user_id.trim()
        ? row.app_user_id.trim()
        : null;
    const local = appUserId ? await getUserById(appUserId) : null;
    const registeredAt =
      row.terms_agreed_at || row.created_at || new Date().toISOString();
    const createdAtMs = Date.parse(registeredAt);

    mapped.push({
      id: appUserId || row.id,
      supabaseUserId: row.id,
      appUserId,
      email: row.email ?? local?.email ?? null,
      name: row.name ?? local?.name ?? null,
      avatarUrl: row.avatar_url ?? local?.image ?? null,
      provider: mapSupabaseProviderToAuthId(local?.provider),
      planId: (local?.planId || "free") as PlanId,
      credits: typeof local?.credits === "number" ? local.credits : 0,
      createdAt: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
      termsAgreed: true,
    });
  }

  mapped.sort((a, b) => b.createdAt - a.createdAt);
  return mapped;
}
