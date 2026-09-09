import {
  PARTNER_SLOT_IDS,
  type PartnerSlotId,
} from "@/lib/partners/constants";

const SLOT_SET = new Set<string>(PARTNER_SLOT_IDS);

/** Normalize ?ref= values to partner01–partner10, or null. */
export function normalizePartnerCode(
  raw: string | null | undefined
): PartnerSlotId | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned) return null;

  // Accept partner01, partner1, p01, 01
  let code = cleaned;
  if (/^\d{1,2}$/.test(cleaned)) {
    code = `partner${cleaned.padStart(2, "0")}`;
  } else if (/^p\d{1,2}$/.test(cleaned)) {
    code = `partner${cleaned.slice(1).padStart(2, "0")}`;
  } else if (/^partner\d{1,2}$/.test(cleaned)) {
    const n = cleaned.replace("partner", "");
    code = `partner${n.padStart(2, "0")}`;
  }

  return SLOT_SET.has(code) ? (code as PartnerSlotId) : null;
}

export function isPartnerSlotId(value: string): value is PartnerSlotId {
  return SLOT_SET.has(value);
}

export function buildPartnerReferralPath(code: PartnerSlotId): string {
  return `/?ref=${encodeURIComponent(code)}`;
}
