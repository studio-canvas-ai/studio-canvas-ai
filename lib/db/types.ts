import type { BillingInterval, pricingPlanIds } from "@/lib/data";

export type PlanId = "free" | (typeof pricingPlanIds)[number];

export type AuthProviderId =
  | "kakao"
  | "google"
  | "naver"
  | "credentials"
  | "google-mock";

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
  billingInterval?: BillingInterval;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  lastPlanAmountKrw?: number;
  subscriptionStatus?: "active" | "past_due" | "cancelled";
  paymentRetryCount?: number;
  nextPaymentRetryAt?: number;
  paymentGraceEndsAt?: number;
  lastPaymentFailureAt?: number;
  billingKey?: string;
  providerCustomerKey?: string;
  cancelledAt?: number;
  lastPaidPlan?: (typeof pricingPlanIds)[number];
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
    | "subscription_upgrade"
    | "subscription_renewal"
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
  billingInterval?: BillingInterval;
  packId?: string;
  baseAmountKrw?: number;
  prorationCreditKrw?: number;
  amountKrw: number;
  credits: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  externalPaymentKey?: string;
  createdAt: number;
  paidAt?: number;
  failedAt?: number;
  failureReason?: string;
};

export type PaymentNotice = {
  id: string;
  userId: string;
  orderId: string;
  type: "card_check" | "retry_failed" | "payment_recovered" | "subscription_cancelled";
  attempt: 1 | 2 | 3;
  createdAt: number;
  deliveredAt?: number;
};

export type PromotionCreditOption = 10 | 20 | 50 | 100;

export type PromotionCode = {
  id: string;
  batchId: string;
  codeHash: string;
  codeSuffix: string;
  initialCredits: PromotionCreditOption;
  remainingCredits: number;
  issuedAt: number;
  expiresAt: number;
  isExpired: boolean;
  expiredAt?: number;
  lastUsedAt?: number;
  useCount: number;
};

export type PromotionBatch = {
  id: string;
  creditAmount: PromotionCreditOption;
  quantity: number;
  createdAt: number;
  createdBy: string;
};

export type PromotionHistoryEntry = {
  id: string;
  promotionId: string;
  type: "issued" | "activated" | "generate" | "regenerate" | "expired";
  delta: number;
  balanceAfter: number;
  createdAt: number;
  meta?: Record<string, string | number | boolean | null>;
};

export type DbSnapshot = {
  users: Record<string, UserRecord>;
  /** provider:providerAccountId → userId */
  identities: Record<string, string>;
  ledger: CreditLedgerEntry[];
  orders: Record<string, PaymentOrder>;
  paymentNotices: PaymentNotice[];
  promotionCodes: Record<string, PromotionCode>;
  promotionBatches: Record<string, PromotionBatch>;
  promotionHistory: PromotionHistoryEntry[];
};
