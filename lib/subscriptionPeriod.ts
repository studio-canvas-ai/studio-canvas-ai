import type { BillingInterval } from "@/lib/data";

/** Display and calendar arithmetic follow Korea local dates. */
export const SUBSCRIPTION_CALENDAR_TZ = "Asia/Seoul";

export type CalendarYmd = { y: number; m: number; d: number };

export function ymdInTimeZone(
  date: Date,
  timeZone = SUBSCRIPTION_CALENDAR_TZ
): CalendarYmd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { y: num("year"), m: num("month"), d: num("day") };
}

export function formatYmd({ y, m, d }: CalendarYmd): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addCalendarMonths(ymd: CalendarYmd, months: number): CalendarYmd {
  const total = ymd.y * 12 + (ymd.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { y, m, d: Math.min(ymd.d, lastDay) };
}

function addCalendarDays(ymd: CalendarYmd, days: number): CalendarYmd {
  const dt = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

export function intervalCalendarMonths(interval: BillingInterval): number {
  if (interval === "annual") return 12;
  if (interval === "quarterly") return 3;
  return 1;
}

/**
 * SaaS period end: same calendar date N months later, minus one day.
 * 2026-08-23 monthly → 2026-09-22; quarterly → 2026-11-22.
 */
export function subscriptionEndYmd(
  start: Date,
  interval: BillingInterval,
  timeZone = SUBSCRIPTION_CALENDAR_TZ
): CalendarYmd {
  const startYmd = ymdInTimeZone(start, timeZone);
  const sameDate = addCalendarMonths(startYmd, intervalCalendarMonths(interval));
  return addCalendarDays(sameDate, -1);
}

export function formatSubscriptionEndDate(
  endMs: number | null | undefined,
  timeZone = SUBSCRIPTION_CALENDAR_TZ
): string | null {
  if (endMs == null || !Number.isFinite(endMs)) return null;
  return formatYmd(ymdInTimeZone(new Date(endMs), timeZone));
}

/** Inclusive last instant of the expiry date in Asia/Seoul. */
export function subscriptionPeriodEndMs(
  startMs: number,
  interval: BillingInterval
): number {
  const ymd = subscriptionEndYmd(new Date(startMs), interval);
  return new Date(`${formatYmd(ymd)}T23:59:59.999+09:00`).getTime();
}

/**
 * Remaining whole days until end_date (YYYY-MM-DD), matching
 * Math.ceil((new Date(end_date) - new Date()) / (1000 * 60 * 60 * 24)).
 */
export function remainingSubscriptionDays(
  endDate: string | number | Date,
  now = new Date()
): number {
  const end = new Date(endDate);
  if (!Number.isFinite(end.getTime())) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
