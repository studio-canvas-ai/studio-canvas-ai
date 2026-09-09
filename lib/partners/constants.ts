/** Fixed YouTuber partner slots (empty until email/channel mapped). */
export const PARTNER_SLOT_COUNT = 10;

export const PARTNER_SLOT_IDS = [
  "partner01",
  "partner02",
  "partner03",
  "partner04",
  "partner05",
  "partner06",
  "partner07",
  "partner08",
  "partner09",
  "partner10",
] as const;

export type PartnerSlotId = (typeof PARTNER_SLOT_IDS)[number];

/** Query param + cookie value, e.g. ?ref=partner01 */
export const PARTNER_REF_QUERY = "ref";

/** HTTP-only cookie capturing last valid partner ref. */
export const PARTNER_REF_COOKIE = "sca_partner_ref";

/** Keep referral attribution window (90 days). */
export const PARTNER_REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/** Partner share of paid subscription amount. */
export const PARTNER_COMMISSION_RATE = 0.1;
