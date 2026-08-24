import { getToken } from "next-auth/jwt";
import {
  authSessionCookieName,
  useSecureAuthCookies,
} from "@/lib/authCookies";
import { requireAuthSecret } from "@/lib/authSecret";
import { getDb, identityKey, stableUserId } from "@/lib/db/store";
import type { AuthProviderId, UserRecord } from "@/lib/db/types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function add(set: Set<string>, value: unknown) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed) set.add(trimmed);
}

function findLocalUserIdsByEmail(email: string | null | undefined): string[] {
  const needle = (email || "").trim().toLowerCase();
  if (!needle) return [];
  return Object.values(getDb().users)
    .filter((u) => (u.email || "").trim().toLowerCase() === needle)
    .map((u) => u.id);
}

/**
 * Every id this account has ever been stored under.
 * Login/bridge historically keyed R2 + JSON by session.uid, supabase UUID,
 * or sha256(provider:account) — listing only the current id hides old rows.
 */
export async function collectUserStorageAliases(
  req: Request,
  user: UserRecord
): Promise<string[]> {
  const ids = new Set<string>();
  add(ids, user.id);
  add(ids, user.providerAccountId);

  if (user.provider && user.providerAccountId) {
    add(ids, stableUserId(user.provider, user.providerAccountId));
    add(ids, identityKey(user.provider, user.providerAccountId));
  }

  for (const localId of findLocalUserIdsByEmail(user.email)) {
    add(ids, localId);
  }

  try {
    const secret = requireAuthSecret();
    const token = await getToken({
      req,
      secret,
      secureCookie: useSecureAuthCookies(),
      cookieName: authSessionCookieName(),
    });
    if (token) {
      add(ids, token.uid);
      add(ids, token.supabaseUserId);
      add(ids, token.providerAccountId);
      const provider = token.authProvider as AuthProviderId | undefined;
      const accountId =
        typeof token.providerAccountId === "string"
          ? token.providerAccountId
          : typeof token.supabaseUserId === "string"
            ? token.supabaseUserId
            : null;
      if (provider && accountId) {
        add(ids, stableUserId(provider, accountId));
      }
    }
  } catch {
    /* jwt optional */
  }

  const admin = createSupabaseServiceClient();
  if (admin) {
    try {
      const orFilters: string[] = [];
      if (user.email) orFilters.push(`email.eq.${user.email}`);
      if (user.id) orFilters.push(`app_user_id.eq.${user.id}`);
      if (user.providerAccountId) {
        orFilters.push(`id.eq.${user.providerAccountId}`);
        orFilters.push(`app_user_id.eq.${user.providerAccountId}`);
      }
      if (orFilters.length) {
        const { data } = await admin
          .from("profiles")
          .select("id, app_user_id, email")
          .or(orFilters.join(","));
        for (const row of data ?? []) {
          add(ids, (row as { id?: string }).id);
          add(ids, (row as { app_user_id?: string | null }).app_user_id);
        }
      }
    } catch (err) {
      console.warn("[studioStore] profile alias lookup failed", err);
    }
  }

  return [...ids];
}
