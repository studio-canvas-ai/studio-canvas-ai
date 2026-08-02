/**
 * Same-origin API helpers.
 *
 * Browser calls must stay relative (`/api/...`) so apex / www custom domains
 * never cross-origin or hit redirect-broken absolute URLs from NEXT_PUBLIC_SITE_URL.
 */

export type ApiJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  /** network | non_json | empty | server message */
  error?: string;
  rawPreview?: string;
};

/** Build an API path. Prefers relative URLs; absolute only if NEXT_PUBLIC_API_URL is set. */
export function resolveApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  // Intentionally ignore NEXT_PUBLIC_SITE_URL here — using the marketing origin
  // for API calls breaks when the user is on www vs apex (308 + empty body).
  if (apiBase) return `${apiBase}${normalized}`;
  return normalized;
}

export async function apiFetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<ApiJsonResult<T>> {
  const url = resolveApiUrl(path);
  try {
    const res = await fetch(url, {
      ...init,
      credentials: init?.credentials ?? "same-origin",
    });
    const text = await res.text();
    if (!text) {
      console.error("[apiFetchJson] empty response body", {
        url,
        status: res.status,
        statusText: res.statusText,
      });
      return {
        ok: false,
        status: res.status,
        data: null,
        error: res.status >= 500 ? "server_error_empty" : "empty",
      };
    }
    try {
      const data = JSON.parse(text) as T;
      return { ok: res.ok, status: res.status, data };
    } catch {
      const preview = text.slice(0, 240);
      console.error("[apiFetchJson] non-JSON response", {
        url,
        status: res.status,
        preview,
      });
      return {
        ok: false,
        status: res.status,
        data: null,
        error: "non_json",
        rawPreview: preview,
      };
    }
  } catch (err) {
    console.error("[apiFetchJson] network/fetch failure", { url, err });
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : "network",
    };
  }
}
