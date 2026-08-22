/**
 * Supabase Edge Function: Kakao userinfo → flat OIDC claims (KOE205-safe).
 *
 * Kakao returns nested kakao_account / properties. GoTrue needs top-level
 * sub + email. Synthetic `{id}@users.kakao.id` when account_email is absent.
 *
 * Deploy:
 *   npx supabase functions deploy kakao-userinfo --project-ref oorujqbivznftsyqilyj --no-verify-jwt
 *
 * Userinfo URL:
 *   https://oorujqbivznftsyqilyj.supabase.co/functions/v1/kakao-userinfo
 */

const KAKAO_USERINFO_URL = "https://kapi.kakao.com/v2/user/me";

function normalizeAuthorization(header: string | null): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  const token = (match?.[1] ?? trimmed).trim();
  if (!token || /\s/.test(token)) return null;
  return `Bearer ${token}`;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, {
      status: 405,
      headers: corsHeaders(),
    });
  }

  const authorization = normalizeAuthorization(req.headers.get("Authorization"));
  if (!authorization) {
    return Response.json(
      { error: "Missing Authorization header (expected: Bearer <kakao_access_token>)" },
      { status: 401, headers: corsHeaders() },
    );
  }

  let kakaoResponse: Response;
  try {
    kakaoResponse = await fetch(KAKAO_USERINFO_URL, {
      method: "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `Kakao userinfo fetch failed: ${message}` },
      { status: 502, headers: corsHeaders() },
    );
  }

  const text = await kakaoResponse.text();
  if (!kakaoResponse.ok) {
    return Response.json(
      { error: `Failed to fetch user info from Kakao (${kakaoResponse.status})` },
      {
        status: kakaoResponse.status === 401 ? 401 : 502,
        headers: corsHeaders(),
      },
    );
  }

  let data: {
    id?: string | number;
    properties?: {
      nickname?: string;
      profile_image?: string;
      thumbnail_image?: string;
    };
    kakao_account?: {
      email?: string;
      is_email_valid?: boolean;
      is_email_verified?: boolean;
      profile?: {
        nickname?: string;
        profile_image_url?: string;
        thumbnail_image_url?: string;
      };
    };
  };
  try {
    data = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "Invalid JSON from Kakao userinfo" },
      { status: 502, headers: corsHeaders() },
    );
  }

  const sub = data.id != null ? String(data.id).trim() : "";
  if (!sub) {
    return Response.json(
      { error: "Kakao response.id missing; cannot set OIDC sub" },
      { status: 502, headers: corsHeaders() },
    );
  }

  const account = data.kakao_account ?? {};
  const profile = account.profile ?? {};
  const props = data.properties ?? {};
  const emailRaw = typeof account.email === "string" ? account.email.trim() : "";
  const email = emailRaw || `${sub}@users.kakao.id`;
  const nickname =
    (typeof profile.nickname === "string" && profile.nickname.trim()) ||
    (typeof props.nickname === "string" && props.nickname.trim()) ||
    undefined;
  const picture =
    (typeof profile.profile_image_url === "string" &&
      profile.profile_image_url.trim()) ||
    (typeof props.profile_image === "string" && props.profile_image.trim()) ||
    undefined;

  const body: Record<string, unknown> = {
    sub,
    id: sub,
    email,
    email_verified: Boolean(
      emailRaw && account.is_email_valid !== false && account.is_email_verified
    ),
  };
  if (nickname) {
    body.name = nickname;
    body.nickname = nickname;
    body.preferred_username = nickname;
  }
  if (picture) body.picture = picture;

  return Response.json(body, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
});
