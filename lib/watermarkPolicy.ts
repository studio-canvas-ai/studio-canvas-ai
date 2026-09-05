import { isUnlimitedAccountEmail } from "@/lib/unlimitedAccount";

/**
 * Brand watermark (on-screen overlay + download bake) applies only to free,
 * non-admin accounts. Subscribers and admins never get a watermark.
 */
export function shouldApplyBrandWatermark(
  planId: string | null | undefined,
  email?: string | null,
  isAdmin = false
): boolean {
  if (planId && planId !== "free") return false;
  if (isAdmin) return false;
  if (isUnlimitedAccountEmail(email)) return false;
  return true;
}
