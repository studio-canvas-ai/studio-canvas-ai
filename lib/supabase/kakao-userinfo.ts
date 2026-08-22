/**
 * Kakao /v2/user/me nests profile under `kakao_account` / `properties`.
 * Supabase Custom OAuth expects flat OIDC userinfo (top-level `sub` / `email`).
 *
 * Built-in Supabase Kakao hardcodes `account_email` → KOE205 when that consent
 * item is unavailable. Use Custom OAuth (`custom:kakao`) + this proxy with
 * scopes `profile_nickname,profile_image` only (no account_email, no openid).
 */

export const KAKAO_USERINFO_URL = "https://kapi.kakao.com/v2/user/me";

export type KakaoMeEnvelope = {
  id?: string | number;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
    [key: string]: unknown;
  };
  kakao_account?: {
    email?: string;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

/** Flat claims Supabase GoTrue reads (`Claims.Email`, `Claims.Subject`). */
export type KakaoOidcUserinfo = {
  sub: string;
  id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  nickname?: string;
  preferred_username?: string;
  picture?: string;
};

/**
 * Normalize inbound Authorization to Kakao's required form:
 * `Authorization: Bearer {access_token}`
 */
export function normalizeKakaoAuthorization(
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

export function flattenKakaoUserinfo(
  data: KakaoMeEnvelope
): KakaoOidcUserinfo | null {
  const id = data.id != null ? String(data.id).trim() : "";
  if (!id) return null;

  const account = data.kakao_account ?? {};
  const profile = account.profile ?? {};
  const props = data.properties ?? {};

  const emailRaw =
    typeof account.email === "string" ? account.email.trim() : "";
  // Nickname/profile-only consent: stable synthetic address for Supabase email checks.
  const email = emailRaw || `${id}@users.kakao.id`;

  const nickname =
    (typeof profile.nickname === "string" && profile.nickname.trim()) ||
    (typeof props.nickname === "string" && props.nickname.trim()) ||
    undefined;

  const picture =
    (typeof profile.profile_image_url === "string" &&
      profile.profile_image_url.trim()) ||
    (typeof profile.thumbnail_image_url === "string" &&
      profile.thumbnail_image_url.trim()) ||
    (typeof props.profile_image === "string" && props.profile_image.trim()) ||
    (typeof props.thumbnail_image === "string" && props.thumbnail_image.trim()) ||
    undefined;

  const oidc: KakaoOidcUserinfo = {
    sub: id,
    id,
    email,
    email_verified: Boolean(
      emailRaw && account.is_email_valid !== false && account.is_email_verified
    ),
  };
  if (nickname) {
    oidc.name = nickname;
    oidc.nickname = nickname;
    oidc.preferred_username = nickname;
  }
  if (picture) oidc.picture = picture;

  return oidc;
}

/** Fetch Kakao profile and return OIDC-shaped userinfo for Supabase Auth. */
export async function fetchKakaoOidcUserinfo(
  authorizationHeader: string
): Promise<
  | { ok: true; body: KakaoOidcUserinfo; usedSyntheticEmail: boolean }
  | { ok: false; status: number; error: string }
> {
  const authorization = normalizeKakaoAuthorization(authorizationHeader);
  if (!authorization) {
    return { ok: false, status: 401, error: "Missing or invalid Authorization header" };
  }

  const kakaoResponse = await fetch(KAKAO_USERINFO_URL, {
    method: "GET",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const responseText = await kakaoResponse.text();

  if (!kakaoResponse.ok) {
    console.error(
      "Kakao /v2/user/me failed:",
      kakaoResponse.status,
      responseText.slice(0, 200)
    );
    return {
      ok: false,
      status: kakaoResponse.status === 401 ? 401 : 502,
      error: `Failed to fetch user info from Kakao (${kakaoResponse.status})`,
    };
  }

  let data: KakaoMeEnvelope;
  try {
    data = JSON.parse(responseText) as KakaoMeEnvelope;
  } catch {
    return { ok: false, status: 502, error: "Invalid JSON from Kakao userinfo" };
  }

  const oidc = flattenKakaoUserinfo(data);
  if (!oidc) {
    console.error(
      "Kakao userinfo flatten failed:",
      JSON.stringify({
        hasId: data.id != null,
        hasAccount: Boolean(data.kakao_account),
        hasEmail: Boolean(
          typeof data.kakao_account?.email === "string" && data.kakao_account.email
        ),
      })
    );
    return {
      ok: false,
      status: 502,
      error: "Kakao API error or missing profile.id",
    };
  }

  const usedSyntheticEmail = oidc.email.endsWith("@users.kakao.id");
  if (usedSyntheticEmail) {
    console.warn(
      "Kakao profile missing email; using synthetic @users.kakao.id for Supabase (KOE205-safe path)."
    );
  }

  return { ok: true, body: oidc, usedSyntheticEmail };
}
