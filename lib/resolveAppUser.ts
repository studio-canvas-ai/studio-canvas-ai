import { getToken } from "next-auth/jwt";
import { auth } from "@/lib/auth";
import {
  authSessionCookieName,
  useSecureAuthCookies,
} from "@/lib/authCookies";
import { requireAuthSecret } from "@/lib/authSecret";
import {
  ensureUserRecord,
  findOrCreateOAuthUser,
  getUserById,
  reconcileUserWithWalletCookie,
} from "@/lib/db/credits";
import type { AuthProviderId, UserRecord } from "@/lib/db/types";
import { FREE_CREDITS } from "@/lib/data";
import { readWalletCookie } from "@/lib/walletCookie";
import { ensureGuestCheckoutUser } from "@/lib/guestCheckout";
import { hydrateUserPlanUsage } from "@/lib/db/planUsage";

export type ResolveAppUserResult =
  | { ok: true; user: UserRecord }
  | {
      ok: false;
      error: "authentication required" | "terms_required" | "user not found";
      status: 401 | 404;
    };

export type ResolveAppUserOptions = {
  /**
   * When true, mint/reuse a cookie-backed guest wallet if there is no session.
   * Used for KCP review / PG checkout without forcing login.
   */
  allowGuest?: boolean;
};

/**
 * Resolve the local app user for payment / account / generate APIs.
 *
 * On Vercel the in-memory DB is empty after cold starts even when the JWT
 * session is valid. Rehydrate via JWT identity claims + signed wallet cookie
 * so credit balances survive across isolates.
 */
export async function resolveAppUser(
  req: Request,
  options: ResolveAppUserOptions = {}
): Promise<ResolveAppUserResult> {
  const session = await auth();
  const sessionUser = session?.user as
    | { id?: string; email?: string | null; name?: string | null; image?: string | null }
    | undefined;
  let userId = sessionUser?.id;
  let user = userId ? await getUserById(userId) : null;
  if (user) {
    user = await reconcileUserWithWalletCookie(user);
    user = await hydrateUserPlanUsage(user);
    return { ok: true, user };
  }

  try {
    const secret = requireAuthSecret();
    const token = await getToken({
      req,
      secret,
      secureCookie: useSecureAuthCookies(),
      cookieName: authSessionCookieName(),
    });

    if (!token && !userId) {
      if (options.allowGuest) {
        const guest = await ensureGuestCheckoutUser();
        return { ok: true, user: guest };
      }
      return { ok: false, error: "authentication required", status: 401 };
    }

    if (token?.termsAgreed === false) {
      return { ok: false, error: "terms_required", status: 401 };
    }

    const provider = token?.authProvider as AuthProviderId | undefined;
    const providerAccountId =
      typeof token?.providerAccountId === "string"
        ? token.providerAccountId
        : typeof token?.supabaseUserId === "string"
          ? token.supabaseUserId
          : typeof token?.email === "string" &&
              (provider === "credentials" || provider === "google-mock")
            ? token.email
            : null;

    const provisionalId = String(userId || token?.uid || "");
    const wallet = await readWalletCookie(provisionalId || null);
    const jwtCredits =
      typeof token?.credits === "number" ? token.credits : null;
    const creditsHint =
      wallet?.credits ??
      jwtCredits ??
      (provisionalId ? null : FREE_CREDITS);

    if (provider && providerAccountId && token) {
      const created = await findOrCreateOAuthUser({
        provider,
        providerAccountId,
        email: typeof token.email === "string" ? token.email : null,
        name: typeof token.name === "string" ? token.name : null,
        image: typeof token.picture === "string" ? token.picture : null,
        creditsHint,
      });
      const hydrated = await hydrateUserPlanUsage(created.user, {
        supabaseUserId:
          typeof token.supabaseUserId === "string" ? token.supabaseUserId : null,
      });
      return { ok: true, user: hydrated };
    }

    // Session/JWT has an id but identity claims are incomplete — provision in place.
    if (userId || token?.uid) {
      userId = String(userId || token?.uid);
      const ensured = await ensureUserRecord({
        userId,
        email:
          sessionUser?.email ??
          (typeof token?.email === "string" ? token.email : null),
        name:
          sessionUser?.name ??
          (typeof token?.name === "string" ? token.name : null),
        image:
          sessionUser?.image ??
          (typeof token?.picture === "string" ? token.picture : null),
        provider,
        providerAccountId,
        credits: creditsHint ?? FREE_CREDITS,
      });
      const hydrated = await hydrateUserPlanUsage(ensured, {
        supabaseUserId:
          typeof token?.supabaseUserId === "string" ? token.supabaseUserId : null,
      });
      return { ok: true, user: hydrated };
    }
  } catch {
    /* fall through */
  }

  // Session claimed an id even if JWT parse failed — still auto-provision.
  if (userId) {
    const wallet = await readWalletCookie(userId);
    const ensured = await ensureUserRecord({
      userId,
      email: sessionUser?.email ?? null,
      name: sessionUser?.name ?? null,
      image: sessionUser?.image ?? null,
      credits: wallet?.credits,
    });
    const hydrated = await hydrateUserPlanUsage(ensured);
    return { ok: true, user: hydrated };
  }

  if (options.allowGuest) {
    try {
      const guest = await ensureGuestCheckoutUser();
      return { ok: true, user: guest };
    } catch {
      /* fall through */
    }
  }

  return { ok: false, error: "authentication required", status: 401 };
}
