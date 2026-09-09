/**
 * Cloudflare Worker: same-origin R2 upload proxy.
 *
 * Production (studio-canvas-ai.com):
 *   POST /api/shorts/stream-upload/v1/session  JSON { target: presigned R2 PUT URL }
 *   PUT  /api/shorts/stream-upload/v1/put/:id   raw file body → stream to R2
 *
 * Legacy workers.dev (localhost mobile fallback):
 *   POST /v1/session  ·  PUT /v1/put/:id
 */

export type Env = {
  ALLOWED_ORIGINS: string;
  UPLOAD_SESSIONS: KVNamespace;
};

const R2_HOST_SUFFIX = ".r2.cloudflarestorage.com";
const STREAM_UPLOAD_PREFIX = "/api/shorts/stream-upload";
const UPLOAD_SUFFIX = "/v1/put";
const SESSION_SUFFIX = "/v1/session";
const SESSION_TTL_SEC = 600;

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null, allowed: string[]): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, X-R2-Upload-Url",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "ETag",
    Vary: "Origin",
  };
  if (origin && (allowed.includes(origin) || allowed.includes("*"))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  allowed: string[]
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin, allowed),
    },
  });
}

function isAllowedOrigin(origin: string | null, allowed: string[]): boolean {
  if (!origin) return true;
  return allowed.includes(origin) || allowed.includes("*");
}

function isAllowedR2PutUrl(target: string): boolean {
  try {
    const u = new URL(target);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return host.endsWith(R2_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** Strip same-origin prefix; keep legacy /v1/* paths as-is. */
function resolveApiPath(pathname: string): {
  apiPath: string;
  mountPrefix: string;
} {
  if (pathname.startsWith(STREAM_UPLOAD_PREFIX)) {
    const rest = pathname.slice(STREAM_UPLOAD_PREFIX.length);
    return {
      apiPath: rest || "/",
      mountPrefix: STREAM_UPLOAD_PREFIX,
    };
  }
  return { apiPath: pathname, mountPrefix: "" };
}

function resolveLegacyR2TargetUrl(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("u")?.trim();
  if (fromQuery) return fromQuery;
  return request.headers.get("X-R2-Upload-Url")?.trim() || null;
}

async function forwardPutToR2(
  r2Url: string,
  request: Request
): Promise<Response> {
  const forwardHeaders = new Headers();
  const contentLength = request.headers.get("Content-Length");
  if (contentLength) forwardHeaders.set("Content-Length", contentLength);

  return fetch(r2Url, {
    method: "PUT",
    body: request.body,
    headers: forwardHeaders,
  });
}

function resolvePublicOrigin(request: Request): string {
  const forwardedHost = request.headers
    .get("X-Forwarded-Host")
    ?.split(",")[0]
    ?.trim();
  const url = new URL(request.url);
  const host = forwardedHost || url.host;
  const proto =
    request.headers.get("X-Forwarded-Proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "") ||
    "https";
  return `${proto}://${host}`;
}

async function handleSession(
  request: Request,
  env: Env,
  allowed: string[],
  mountPrefix: string
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, allowed)) {
    return jsonResponse({ error: "forbidden_origin" }, 403, origin, allowed);
  }

  let payload: { target?: string };
  try {
    payload = (await request.json()) as { target?: string };
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin, allowed);
  }

  const r2Url = payload.target?.trim();
  if (!r2Url) {
    return jsonResponse({ error: "missing_target" }, 400, origin, allowed);
  }
  if (!isAllowedR2PutUrl(r2Url)) {
    return jsonResponse({ error: "forbidden_r2_target" }, 403, origin, allowed);
  }

  const uploadId = crypto.randomUUID();
  await env.UPLOAD_SESSIONS.put(uploadId, r2Url, {
    expirationTtl: SESSION_TTL_SEC,
  });

  const publicOrigin = resolvePublicOrigin(request);
  const putPath = `${mountPrefix}${UPLOAD_SUFFIX}/${uploadId}`;
  const putUrl = `${publicOrigin}${putPath}`;

  return jsonResponse(
    {
      ok: true,
      uploadId,
      putUrl,
      expiresInSec: SESSION_TTL_SEC,
      sameOrigin: Boolean(mountPrefix),
    },
    200,
    origin,
    allowed
  );
}

async function handlePutBySessionId(
  request: Request,
  uploadId: string,
  env: Env,
  allowed: string[]
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, allowed)) {
    return jsonResponse({ error: "forbidden_origin" }, 403, origin, allowed);
  }

  const r2Url = await env.UPLOAD_SESSIONS.get(uploadId);
  if (!r2Url) {
    return jsonResponse(
      { error: "session_not_found_or_expired" },
      404,
      origin,
      allowed
    );
  }

  let r2Res: Response;
  try {
    r2Res = await forwardPutToR2(r2Url, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "r2_forward_failed";
    return jsonResponse({ error: message }, 502, origin, allowed);
  }

  if (r2Res.ok) {
    await env.UPLOAD_SESSIONS.delete(uploadId);
  }

  const outHeaders = new Headers(corsHeaders(origin, allowed));
  const etag = r2Res.headers.get("ETag");
  if (etag) outHeaders.set("ETag", etag);

  return new Response(r2Res.body, {
    status: r2Res.status,
    statusText: r2Res.statusText,
    headers: outHeaders,
  });
}

/** Legacy: PUT …/v1/put?u=… or X-R2-Upload-Url header */
async function handleLegacyPut(
  request: Request,
  allowed: string[]
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, allowed)) {
    return jsonResponse({ error: "forbidden_origin" }, 403, origin, allowed);
  }

  const r2Url = resolveLegacyR2TargetUrl(request);
  if (!r2Url) {
    return jsonResponse({ error: "missing_r2_target" }, 400, origin, allowed);
  }
  if (!isAllowedR2PutUrl(r2Url)) {
    return jsonResponse({ error: "forbidden_r2_target" }, 403, origin, allowed);
  }

  let r2Res: Response;
  try {
    r2Res = await forwardPutToR2(r2Url, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "r2_forward_failed";
    return jsonResponse({ error: message }, 502, origin, allowed);
  }

  const outHeaders = new Headers(corsHeaders(origin, allowed));
  const etag = r2Res.headers.get("ETag");
  if (etag) outHeaders.set("ETag", etag);

  return new Response(r2Res.body, {
    status: r2Res.status,
    statusText: r2Res.statusText,
    headers: outHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS || "");
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    const { apiPath, mountPrefix } = resolveApiPath(url.pathname);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, allowed),
      });
    }

    if (
      request.method === "GET" &&
      (apiPath === "/health" || url.pathname === "/health")
    ) {
      return jsonResponse(
        {
          ok: true,
          service: "shorts-r2-upload",
          sessionUpload: true,
          sameOriginPath: STREAM_UPLOAD_PREFIX,
        },
        200,
        origin,
        allowed
      );
    }

    if (request.method === "POST" && apiPath === SESSION_SUFFIX) {
      return handleSession(request, env, allowed, mountPrefix);
    }

    const sessionPutMatch = apiPath.match(
      /^\/v1\/put\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
    );
    if (request.method === "PUT" && sessionPutMatch) {
      return handlePutBySessionId(request, sessionPutMatch[1], env, allowed);
    }

    if (request.method === "PUT" && apiPath === UPLOAD_SUFFIX) {
      return handleLegacyPut(request, allowed);
    }

    return jsonResponse({ error: "not_found" }, 404, origin, allowed);
  },
};
