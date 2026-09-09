/**
 * IP / account rate limiter — in-memory with optional Upstash REST fallback later.
 * Survives within a single Node process (dev / single instance).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const MINUTE_MS = 60 * 1000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

export function rateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(params.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + params.windowMs;
    buckets.set(params.key, { count: 1, resetAt });
    return { ok: true, remaining: params.limit - 1, resetAt, limit: params.limit };
  }
  if (existing.count >= params.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      limit: params.limit,
    };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: params.limit - existing.count,
    resetAt: existing.resetAt,
    limit: params.limit,
  };
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Download APIs (storage original, general-photo download):
 * default 30 req / 1 min per IP, 60 / 1 min per account.
 */
export function checkDownloadRateLimit(req: Request, userId?: string | null) {
  const ip = clientIp(req);
  const windowMs = Number(process.env.RATE_LIMIT_DOWNLOAD_WINDOW_MS || MINUTE_MS);
  const ipHit = rateLimit({
    key: `dl:ip:${ip}`,
    limit: Number(process.env.RATE_LIMIT_DOWNLOAD_IP || 30),
    windowMs,
  });
  if (!ipHit.ok) return ipHit;
  if (userId) {
    return rateLimit({
      key: `dl:user:${userId}`,
      limit: Number(process.env.RATE_LIMIT_DOWNLOAD_USER || 60),
      windowMs,
    });
  }
  return ipHit;
}

/**
 * Upload APIs (storage upload, general-photo upload):
 * default 30 req / 1 min per IP, 60 / 1 min per account.
 */
export function checkUploadRateLimit(req: Request, userId?: string | null) {
  const ip = clientIp(req);
  const windowMs = Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || MINUTE_MS);
  const ipHit = rateLimit({
    key: `up:ip:${ip}`,
    limit: Number(process.env.RATE_LIMIT_UPLOAD_IP || 30),
    windowMs,
  });
  if (!ipHit.ok) return ipHit;
  if (userId) {
    return rateLimit({
      key: `up:user:${userId}`,
      limit: Number(process.env.RATE_LIMIT_UPLOAD_USER || 60),
      windowMs,
    });
  }
  return ipHit;
}

/** Generate API: 20 / 10 min per IP, 50 / day soft account window */
export function checkGenerateRateLimit(req: Request, userId?: string | null) {
  const ip = clientIp(req);
  const ipHit = rateLimit({
    key: `gen:ip:${ip}`,
    limit: Number(process.env.RATE_LIMIT_GENERATE_IP || 20),
    windowMs: 10 * 60 * 1000,
  });
  if (!ipHit.ok) return ipHit;
  if (userId) {
    return rateLimit({
      key: `gen:user:${userId}`,
      limit: Number(process.env.RATE_LIMIT_GENERATE_USER || 50),
      windowMs: 24 * 60 * 60 * 1000,
    });
  }
  return ipHit;
}
