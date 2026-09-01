/**
 * Cloudflare Worker: stream browser PUT → R2 presigned URL.
 * Fixes mobile Chrome CORS / network failures on direct cross-origin R2 PUT.
 */

export type Env = {
  ALLOWED_ORIGINS: string;
};

const R2_HOST_SUFFIX = ".r2.cloudflarestorage.com";
const UPLOAD_PATH = "/v1/put";

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null, allowed: string[]): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "PUT, OPTIONS, HEAD, GET",
    "Access-Control-Allow-Headers": "X-R2-Upload-Url",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "ETag",
    Vary: "Origin",
  };
  if (origin && (allowed.includes(origin) || allowed.includes("*"))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
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

async function handlePut(
  request: Request,
  allowed: string[]
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && !allowed.includes(origin) && !allowed.includes("*")) {
    return new Response(JSON.stringify({ error: "forbidden_origin" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin, allowed),
      },
    });
  }

  const r2Url = request.headers.get("X-R2-Upload-Url")?.trim();
  if (!r2Url) {
    return new Response(JSON.stringify({ error: "missing_x_r2_upload_url" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin, allowed),
      },
    });
  }

  if (!isAllowedR2PutUrl(r2Url)) {
    return new Response(JSON.stringify({ error: "forbidden_r2_target" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin, allowed),
      },
    });
  }

  const forwardHeaders = new Headers();
  const contentLength = request.headers.get("Content-Length");
  if (contentLength) forwardHeaders.set("Content-Length", contentLength);

  let r2Res: Response;
  try {
    r2Res = await fetch(r2Url, {
      method: "PUT",
      body: request.body,
      // Do not forward Content-Type — presign omits it; mobile must match.
      headers: forwardHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "r2_forward_failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin, allowed),
      },
    });
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

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, allowed),
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "shorts-r2-upload" }), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(origin, allowed),
        },
      });
    }

    if (request.method === "PUT" && url.pathname === UPLOAD_PATH) {
      return handlePut(request, allowed);
    }

    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin, allowed),
      },
    });
  },
};
