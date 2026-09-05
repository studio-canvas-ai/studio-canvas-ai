import { getDb } from "@/lib/db/store";
import type { PricingPlanId } from "@/lib/data";
import { createPaymentOrder, markOrderPaid } from "@/lib/payments";
import { chargePortOneBillingKey } from "@/lib/payments/portone";
import { handleRenewalFailure } from "@/lib/subscriptionLifecycle";

function recurringPlanName(planId: PricingPlanId): string {
  if (planId === "standard") return "Standard";
  if (planId === "pro") return "Pro";
  return "Starter";
}

/** Cron: bill monthly KCP subscribers whose period ended (billing key on file). */
export async function processSubscriptionRenewals(now = Date.now()) {
  const db = getDb();
  let scanned = 0;
  let renewed = 0;
  let failed = 0;
  let skipped = 0;

  for (const user of Object.values(db.users)) {
    if (user.planId === "free") continue;
    if (user.billingInterval !== "monthly") continue;
    scanned += 1;

    if (user.cancelAtPeriodEnd || user.subscriptionLifecycle === "CANCELED_PENDING") {
      skipped += 1;
      continue;
    }
    if (!user.billingKey?.trim()) {
      skipped += 1;
      continue;
    }
    if (!user.currentPeriodEnd || user.currentPeriodEnd > now) {
      skipped += 1;
      continue;
    }

    const planId = user.planId as PricingPlanId;
    if (planId !== "starter" && planId !== "standard" && planId !== "pro") {
      skipped += 1;
      continue;
    }

    try {
      const order = await createPaymentOrder({
        userId: user.id,
        kind: "subscription",
        planId,
        billingInterval: "monthly",
        isSubscriber: true,
        locale: "kr",
      });

      const paymentToken = order.id.replace(/[^a-zA-Z0-9]/g, "");
      const paymentId = `renew${paymentToken}`.slice(0, 40);
      const planName = recurringPlanName(planId);

      const charge = await chargePortOneBillingKey({
        paymentId,
        billingKey: user.billingKey,
        orderName: `Studio Canvas AI ${planName} 월간 정기결제`,
        totalAmount: order.amountKrw,
        customerId: user.providerCustomerKey ?? user.id,
        customerEmail: user.email,
        customerName: user.name,
      });

      const status = (charge.status || "").toUpperCase();
      if (status !== "PAID" && status !== "PARTIAL_PAID") {
        await handleRenewalFailure(user.id);
        failed += 1;
        continue;
      }

      await markOrderPaid({
        orderId: order.id,
        externalPaymentKey: paymentId,
        paymentMethodLabel: "PortOne KCP 정기결제 (자동갱신)",
      });
      renewed += 1;
    } catch {
      await handleRenewalFailure(user.id);
      failed += 1;
    }
  }

  return { scanned, renewed, failed, skipped };
}
