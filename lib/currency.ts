/**
 * USD→KRW conversion with in-memory cache + live FX fetch + safe fallbacks.
 * Sync callers keep working via getUsdKrwRate() / usdToKrw().
 */

/** Realistic default when env and live FX are unavailable. */
export const DEFAULT_USD_KRW_RATE = 1400;

const FX_URL =
  process.env.USD_KRW_FX_URL?.trim() || "https://open.er-api.com/v6/latest/USD";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 4_000;

let cachedRate: number | null = null;
let cachedAt = 0;
let inflight: Promise<number> | null = null;

function envFallbackRate(): number {
  const raw = Number(
    process.env.USD_KRW_RATE ??
      process.env.NEXT_PUBLIC_USD_KRW_RATE ??
      DEFAULT_USD_KRW_RATE
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_USD_KRW_RATE;
}

function isValidRate(rate: unknown): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}

/** Push a verified rate into the module cache (server or client). */
export function setCachedUsdKrwRate(rate: number): void {
  if (!isValidRate(rate)) return;
  cachedRate = rate;
  cachedAt = Date.now();
}

/**
 * Synchronous rate for checkout math and UI.
 * Prefers live cache → env (USD_KRW_RATE) → DEFAULT (1400).
 */
export function getUsdKrwRate(): number {
  if (isValidRate(cachedRate)) return cachedRate;
  return envFallbackRate();
}

export function getUsdKrwRateMeta(): {
  rate: number;
  source: "cache" | "env" | "default";
  cachedAt: number | null;
} {
  if (isValidRate(cachedRate)) {
    return { rate: cachedRate, source: "cache", cachedAt };
  }
  const envRaw = process.env.USD_KRW_RATE ?? process.env.NEXT_PUBLIC_USD_KRW_RATE;
  if (envRaw != null && envRaw !== "" && isValidRate(Number(envRaw))) {
    return { rate: Number(envRaw), source: "env", cachedAt: null };
  }
  return { rate: DEFAULT_USD_KRW_RATE, source: "default", cachedAt: null };
}

/**
 * Fetch live USD/KRW. Never throws to callers — always returns a usable rate.
 * Failures (network, timeout, bad payload) fall back to env → default.
 */
export async function refreshUsdKrwRate(options?: {
  force?: boolean;
}): Promise<number> {
  const force = options?.force === true;
  if (
    !force &&
    isValidRate(cachedRate) &&
    Date.now() - cachedAt < CACHE_TTL_MS
  ) {
    return cachedRate;
  }

  if (inflight && !force) return inflight;

  inflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(FX_URL, {
          method: "GET",
          signal: controller.signal,
          headers: { Accept: "application/json" },
          // Avoid Next.js Data Cache sticky stale FX on the server.
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
        const data = (await res.json()) as {
          result?: string;
          rates?: { KRW?: number };
        };
        const krw = data?.rates?.KRW;
        if (!isValidRate(krw)) throw new Error("FX missing KRW");
        // Sanity band — reject absurd spikes/zeros from bad payloads.
        if (krw < 500 || krw > 5000) throw new Error(`FX out of range: ${krw}`);
        setCachedUsdKrwRate(krw);
        return krw;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Keep a previous good cache if present; otherwise env/default.
      if (isValidRate(cachedRate)) return cachedRate;
      return envFallbackRate();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Refresh when stale; safe to await before creating payment orders. */
export async function ensureUsdKrwRate(): Promise<number> {
  return refreshUsdKrwRate({ force: false });
}

/** Floor USD × rate — no "approx" wording in UI. */
export function usdToKrw(usd: number, rate = getUsdKrwRate()): number {
  return Math.floor(usd * rate);
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatKrw(amount: number): string {
  return `₩${amount.toLocaleString("en-US")}`;
}

export function formatUsdWithKrw(usd: number, showKrw: boolean): {
  usdLabel: string;
  krwLabel: string | null;
} {
  const usdLabel = formatUsd(usd);
  if (!showKrw) return { usdLabel, krwLabel: null };
  return { usdLabel, krwLabel: formatKrw(usdToKrw(usd)) };
}
