import type { BillingInterval, pricingPlanIds } from "@/lib/data";
import type { SubscriptionLifecycle } from "@/lib/subscriptionState";
import type { Locale } from "@/lib/i18n/types";

export type PlanId = "free" | (typeof pricingPlanIds)[number];

export type AuthProviderId =
  | "kakao"
  | "google"
  | "naver"
  | "microsoft"
  | "facebook"
  | "instagram"
  | "credentials"
  | "google-mock";

export type PaymentProviderId = "toss" | "portone" | "stripe" | "demo";

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
  lastPlanAmountUsd?: number;
  subscriptionStatus?: "active" | "past_due" | "cancelled";
  subscriptionLifecycle?: SubscriptionLifecycle;
  cancelAtPeriodEnd?: boolean;
  cancelReason?: string;
  scheduledCancelAt?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  defaultPaymentMethodLabel?: string;
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
    | "refund"
    | "payment_refund"
    | "system_error_restore";
  meta?: Record<string, string | number | boolean | null>;
  createdAt: number;
};

export type PaymentOrder = {
  id: string;
  userId: string;
  provider: PaymentProviderId;
  kind: "subscription" | "credit_pack";
  planId?: (typeof pricingPlanIds)[number];
  billingInterval?: BillingInterval;
  packId?: string;
  locale?: Locale;
  currency: "KRW" | "USD";
  amountUsd: number;
  baseAmountKrw?: number;
  prorationCreditKrw?: number;
  amountKrw: number;
  credits: number;
  /** Remaining unused credits from this payment (FIFO consumption). */
  creditsRemaining?: number;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  externalPaymentKey?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  receiptUrl?: string;
  vatIncluded?: boolean;
  createdAt: number;
  paidAt?: number;
  failedAt?: number;
  failureReason?: string;
  refundedAt?: number;
  refundId?: string;
  refundReason?: string;
  /** system_error | customer_request | admin_exception */
  refundKind?: "auto" | "system_error" | "admin_exception";
};

export type ProcessedWebhookEvent = {
  id: string;
  source: "stripe" | "toss" | "portone";
  eventId: string;
  orderId?: string;
  processedAt: number;
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
  processedWebhookEvents: Record<string, ProcessedWebhookEvent>;
  promotionCodes: Record<string, PromotionCode>;
  promotionBatches: Record<string, PromotionBatch>;
  promotionHistory: PromotionHistoryEntry[];
};
