/**
 * IP / account rate limiter — in-memory with optional Upstash REST fallback later.
 * Survives within a single Node process (dev / single instance).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

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

/** Download API: 30 / 10 min per IP, 60 / 10 min per account */
export function checkDownloadRateLimit(req: Request, userId?: string | null) {
  const ip = clientIp(req);
  const ipHit = rateLimit({
    key: `dl:ip:${ip}`,
    limit: Number(process.env.RATE_LIMIT_DOWNLOAD_IP || 30),
    windowMs: 10 * 60 * 1000,
  });
  if (!ipHit.ok) return ipHit;
  if (userId) {
    return rateLimit({
      key: `dl:user:${userId}`,
      limit: Number(process.env.RATE_LIMIT_DOWNLOAD_USER || 60),
      windowMs: 10 * 60 * 1000,
    });
  }
  return ipHit;
}

/** Generate API: 20 / 10 min per IP, 40 / day soft account window */
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
