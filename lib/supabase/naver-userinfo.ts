/**
 * Naver /v1/nid/me wraps profile fields under `response`.
 * Supabase Custom OAuth expects flat OIDC userinfo (top-level `sub` / `email`).
 */

export const NAVER_USERINFO_URL = "https://openapi.naver.com/v1/nid/me";

export type NaverMeEnvelope = {
  resultcode?: string | number;
  message?: string;
  response?: {
    id?: string | number;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
    [key: string]: unknown;
  };
};

/** Flat claims Supabase GoTrue reads (`Claims.Email`, `Claims.Subject`). */
export type OidcUserinfo = {
  sub: string;
  id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  nickname?: string;
  preferred_username?: string;
  picture?: string;
  /** Real Naver contact email (may be @hanmail etc.) — NOT used as Auth email. */
  naver_email?: string;
};

/**
 * Normalize inbound Authorization to Naver's required form:
 * `Authorization: Bearer {access_token}`
 *
 * Accepts `Bearer …`, `bearer …`, or a raw access token.
 */
export function normalizeNaverAuthorization(
  authorizationHeader: string | null | undefined
): string | null {
  if (!authorizationHeader) return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed) return null;

  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  const token = (match?.[1] ?? trimmed).trim();
  if (!token || /\s/.test(token)) return null;

  return `Bearer ${token}`;
}

export function flattenNaverUserinfo(data: NaverMeEnvelope): OidcUserinfo | null {
  const profile = data.response;
  const resultOk = String(data.resultcode ?? "") === "00";
  if (!resultOk || profile == null) return null;

  const id = profile.id != null ? String(profile.id).trim() : "";
  if (!id) return null;

  const emailRaw =
    typeof profile.email === "string" ? profile.email.trim() : "";

  // CRITICAL: Always key Supabase Auth by Naver id, never by contact email.
  // A Naver login id (e.g. scd777) can register hercd@hanmail.net as contact email;
  // using that email caused automatic linking / our hercd block to reject scd777.
  const email = `${id}@users.naver.id`;

  const name =
    (typeof profile.name === "string" && profile.name.trim()) ||
    (typeof profile.nickname === "string" && profile.nickname.trim()) ||
    undefined;
  const nickname =
    typeof profile.nickname === "string" && profile.nickname.trim()
      ? profile.nickname.trim()
      : undefined;
  const picture =
    typeof profile.profile_image === "string" && profile.profile_image.trim()
      ? profile.profile_image.trim()
      : undefined;

  const oidc: OidcUserinfo = {
    sub: id,
    id,
    email,
    email_verified: true,
  };
  if (emailRaw) oidc.naver_email = emailRaw;
  if (name) oidc.name = name;
  if (nickname) {
    oidc.nickname = nickname;
    oidc.preferred_username = nickname;
  }
  if (picture) oidc.picture = picture;

  return oidc;
}

/** Fetch Naver profile and return OIDC-shaped userinfo for Supabase Auth. */
export async function fetchNaverOidcUserinfo(
  authorizationHeader: string
): Promise<
  | { ok: true; body: OidcUserinfo; usedSyntheticEmail: boolean }
  | { ok: false; status: number; error: string }
> {
  const authorization = normalizeNaverAuthorization(authorizationHeader);
  if (!authorization) {
    return { ok: false, status: 401, error: "Missing or invalid Authorization header" };
  }

  const naverResponse = await fetch(NAVER_USERINFO_URL, {
    method: "GET",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const responseText = await naverResponse.text();

  if (!naverResponse.ok) {
    console.error(
      "Naver /v1/nid/me failed:",
      naverResponse.status,
      responseText.slice(0, 200)
    );
    return {
      ok: false,
      status: naverResponse.status === 401 ? 401 : 502,
      error: `Failed to fetch user info from Naver (${naverResponse.status})`,
    };
  }

  let data: NaverMeEnvelope;
  try {
    data = JSON.parse(responseText) as NaverMeEnvelope;
  } catch {
    return { ok: false, status: 502, error: "Invalid JSON from Naver userinfo" };
  }

  const oidc = flattenNaverUserinfo(data);
  if (!oidc) {
    console.error(
      "Naver userinfo flatten failed:",
      JSON.stringify({
        resultcode: data.resultcode,
        message: data.message,
        hasResponse: Boolean(data.response),
        hasId: Boolean(data.response?.id),
        hasEmail: Boolean(
          typeof data.response?.email === "string" && data.response.email
        ),
      })
    );
    return {
      ok: false,
      status: 502,
      error: data.message || "Naver API error or missing profile.id",
    };
  }

  // Always synthetic Auth email by design (see flattenNaverUserinfo).
  return { ok: true, body: oidc, usedSyntheticEmail: true };
}
