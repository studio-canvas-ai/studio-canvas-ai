/** Default USD→KRW rate for display and checkout (#118). */
export const DEFAULT_USD_KRW_RATE = 1350;

export function getUsdKrwRate(): number {
  const raw = Number(process.env.USD_KRW_RATE ?? DEFAULT_USD_KRW_RATE);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_USD_KRW_RATE;
}

/** Floor USD × rate — no "approx" wording in UI. */
export function usdToKrw(usd: number, rate = getUsdKrwRate()): number {
  return Math.floor(usd * rate);
}

export function formatUsd(amount: number): string {
  const fixed = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `$${fixed}`;
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
