import { cookies } from "next/headers";
import { PARTNER_REF_COOKIE } from "@/lib/partners/constants";
import { normalizePartnerCode } from "@/lib/partners/codes";
import { attributePartnerReferral } from "@/lib/partners/store";
import { withDbLock } from "@/lib/db/store";

/** Read partner ref from the request cookie jar (server components / route handlers). */
export async function readPartnerRefCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    return normalizePartnerCode(jar.get(PARTNER_REF_COOKIE)?.value);
  } catch {
    return null;
  }
}

/**
 * Attribute current cookie partner (if any) to an app user.
 * Also stamps UserRecord.partnerCode for local lookups (first-touch).
 */
export async function attributePartnerFromCookie(input: {
  appUserId: string;
  email?: string | null;
  supabaseUserId?: string | null;
  partnerCodeOverride?: string | null;
}): Promise<void> {
  const fromCookie = await readPartnerRefCookie();
  const code = normalizePartnerCode(input.partnerCodeOverride) || fromCookie;
  if (!code) return;

  const result = await attributePartnerReferral({
    partnerCode: code,
    appUserId: input.appUserId,
    email: input.email,
    supabaseUserId: input.supabaseUserId,
  });

  if (!result.ok || !result.partnerId) return;

  try {
    await withDbLock((db) => {
      const user = db.users[input.appUserId];
      if (!user) return;
      if (user.partnerCode) return; // first-touch
      user.partnerCode = result.partnerId!;
      user.updatedAt = Date.now();
    });
  } catch (err) {
    console.warn(
      "[partners] stamp UserRecord.partnerCode failed",
      err instanceof Error ? err.message : err
    );
  }
}
