import type { pricingPlanIds } from "@/lib/data";

export type PlanId = "free" | (typeof pricingPlanIds)[number];

export type AuthProviderId = "kakao" | "google" | "naver" | "credentials";

export type UserRecord = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  provider: AuthProviderId;
  providerAccountId: string;
  credits: number;
  maxCredits: number;
  planId: PlanId;
  createdAt: number;
  updatedAt: number;
  /** True after first signup bonus was granted */
  signupBonusGranted: boolean;
};

export type CreditLedgerEntry = {
  id: string;
  userId: string;
  delta: number;
  balanceAfter: number;
  reason:
    | "signup_bonus"
    | "generate"
    | "regenerate"
    | "subscription"
    | "credit_pack"
    | "admin_adjust"
    | "refund";
  meta?: Record<string, string | number | boolean | null>;
  createdAt: number;
};

export type PaymentOrder = {
  id: string;
  userId: string;
  provider: "toss" | "portone" | "demo";
  kind: "subscription" | "credit_pack";
  planId?: (typeof pricingPlanIds)[number];
  packId?: string;
  amountKrw: number;
  credits: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  externalPaymentKey?: string;
  createdAt: number;
  paidAt?: number;
};

export type DbSnapshot = {
  users: Record<string, UserRecord>;
  /** provider:providerAccountId → userId */
  identities: Record<string, string>;
  ledger: CreditLedgerEntry[];
  orders: Record<string, PaymentOrder>;
};
