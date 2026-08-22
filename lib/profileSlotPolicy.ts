import { getPlanOffer, type BillingInterval } from "@/lib/data";
import type { PlanId } from "@/lib/faceProfiles";
import {
  hasUnlimitedProfileSlots,
  UNLIMITED_PROFILE_SLOTS,
} from "@/lib/unlimitedAccount";

export {
  hasUnlimitedProfileSlots,
  UNLIMITED_PROFILE_SLOTS,
  UNLIMITED_ACCOUNT_EMAILS,
} from "@/lib/unlimitedAccount";

export function resolveProfileMaxSlots(opts: {
  email: string | null | undefined;
  planId: PlanId;
  billingInterval: BillingInterval;
}): number {
  if (hasUnlimitedProfileSlots(opts.email)) return UNLIMITED_PROFILE_SLOTS;
  if (opts.planId === "free") return 1;
  return getPlanOffer(opts.planId, opts.billingInterval).profileSlots;
}
