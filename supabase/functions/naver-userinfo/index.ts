/**
 * Supabase Edge Function: Naver userinfo → flat OIDC claims.
 *
 * Naver returns:
 *   { resultcode: "00", response: { id, email, name, ... } }
 * Supabase GoTrue requires top-level:
 *   { sub, email, email_verified?, name?, ... }
 *
 * Deploy:
 *   npx supabase functions deploy naver-userinfo --project-ref oorujqbivznftsyqilyj
 * (verify_jwt must be false — see supabase/config.toml)
 *
 * Userinfo URL:
 *   https://oorujqbivznftsyqilyj.supabase.co/functions/v1/naver-userinfo
 */

const NAVER_USERINFO_URL = "https://openapi.naver.com/v1/nid/me";

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
      { error: "Missing Authorization header (expected: Bearer <naver_access_token>)" },
      { status: 401, headers: corsHeaders() },
    );
  }

  let naverResponse: Response;
  try {
    naverResponse = await fetch(NAVER_USERINFO_URL, {
      method: "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `Naver userinfo fetch failed: ${message}` },
      { status: 502, headers: corsHeaders() },
    );
  }

  const text = await naverResponse.text();
  if (!naverResponse.ok) {
    return Response.json(
      { error: `Failed to fetch user info from Naver (${naverResponse.status})` },
      {
        status: naverResponse.status === 401 ? 401 : 502,
        headers: corsHeaders(),
      },
    );
  }

  let data: {
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

  try {
    data = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "Invalid JSON from Naver userinfo" },
      { status: 502, headers: corsHeaders() },
    );
  }

  const profile = data.response;
  if (String(data.resultcode ?? "") !== "00" || !profile) {
    return Response.json(
      { error: data.message || "Naver API error or missing response object" },
      { status: 502, headers: corsHeaders() },
    );
  }

  // Map Naver response.id → OIDC `sub` (required by Supabase Auth).
  const sub =
    profile.id !== undefined && profile.id !== null
      ? String(profile.id).trim()
      : "";

  if (!sub) {
    return Response.json(
      { error: "Naver response.id missing; cannot set OIDC sub" },
      { status: 502, headers: corsHeaders() },
    );
  }

  const emailRaw = typeof profile.email === "string" ? profile.email.trim() : "";
  const email = emailRaw || `${sub}@users.naver.id`;
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

  // Flat OIDC userinfo — `sub` MUST be top-level (not under `response`).
  const body: Record<string, unknown> = {
    sub,
    id: sub,
    provider_id: sub,
    email,
    email_verified: Boolean(emailRaw),
  };

  if (name) body.name = name;
  if (nickname) {
    body.nickname = nickname;
    body.preferred_username = nickname;
  }
  if (picture) {
    body.picture = picture;
    body.avatar_url = picture;
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
