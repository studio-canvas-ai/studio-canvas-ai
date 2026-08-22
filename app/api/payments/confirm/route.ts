import { NextResponse } from "next/server";
import {
  confirmTossPayment,
  getPaymentProvider,
  isDemoCheckoutAllowed,
  markOrderPaid,
  requiresKcpRecurringBilling,
  saveBillingCredentials,
} from "@/lib/payments";
import {
  chargePortOneBillingKey,
  fetchPortOnePayment,
} from "@/lib/payments/portone";
import { getDb } from "@/lib/db/store";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { isGuestCheckoutAllowed } from "@/lib/checkoutPolicy";

export const runtime = "nodejs";

/**
 * Confirm payment after Toss / PortOne checkout / KCP billing-key charge / demo.
 * Stripe confirmations are webhook-driven only.
 */
export async function POST(req: Request) {
  const resolved = await resolveAppUser(req, {
    allowGuest: isGuestCheckoutAllowed(),
  });
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }
  const user = resolved.user;
  const userId = user.id;

  const body = (await req.json()) as {
    orderId: string;
    paymentKey?: string;
    paymentId?: string;
    billingKey?: string;
    issueId?: string;
    demo?: boolean;
  };

  const order = getDb().orders[body.orderId];
  if (!order || order.userId !== userId) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ ok: true, order, user });
  }

  if (order.provider === "stripe") {
    return NextResponse.json(
      { error: "awaiting_stripe_webhook", provider: "stripe" },
      { status: 202 }
    );
  }

  const provider = getPaymentProvider(order.locale);
  const portonePaymentId = body.paymentId || body.paymentKey;
  const recurringCheckout = requiresKcpRecurringBilling({
    kind: order.kind,
    billingInterval: order.billingInterval,
    locale: order.locale,
  });

  try {
    if (recurringCheckout && body.billingKey?.trim()) {
      const billingKey = body.billingKey.trim();
      const issueToken = (body.issueId || order.id).replace(/[^a-zA-Z0-9]/g, "");
      const paymentId = `subpay${issueToken}`.slice(0, 40);
      const planLabel =
        order.planId === "pro"
          ? "Pro"
          : order.planId === "standard"
            ? "Standard"
            : "Starter";

      await saveBillingCredentials({
        userId: order.userId,
        billingKey,
        customerKey: user.providerCustomerKey ?? user.id,
      });

      let chargeStatus = "";
      try {
        const charge = await chargePortOneBillingKey({
          paymentId,
          billingKey,
          orderName: `Studio Canvas AI ${planLabel} 월간 정기결제 (1회차)`,
          totalAmount: order.amountKrw,
          customerId: user.providerCustomerKey ?? user.id,
          customerEmail: user.email,
          customerName: user.name,
        });
        chargeStatus = (charge.status || "").toUpperCase();
      } catch (err) {
        const message = err instanceof Error ? err.message : "billing charge failed";
        if (message.includes("portone_secret_missing")) {
          return NextResponse.json(
            { error: "portone_secret_missing" },
            { status: 500 }
          );
        }
        throw err;
      }

      if (chargeStatus !== "PAID" && chargeStatus !== "PARTIAL_PAID") {
        const payment = await fetchPortOnePayment(paymentId).catch(() => null);
        const lookupStatus = (payment?.status || chargeStatus || "unknown").toUpperCase();
        if (lookupStatus !== "PAID" && lookupStatus !== "PARTIAL_PAID") {
          return NextResponse.json(
            { error: `portone_not_paid:${lookupStatus}` },
            { status: 402 }
          );
        }
      }

      const paid = await markOrderPaid({
        orderId: order.id,
        externalPaymentKey: paymentId,
        paymentMethodLabel: "PortOne KCP 정기결제 (빌링키)",
      });
      return NextResponse.json({
        ok: true,
        order: paid,
        user,
        recurring: true,
      });
    }

    if (provider === "toss" && body.paymentKey && !body.paymentId) {
      const tossResult = await confirmTossPayment({
        paymentKey: body.paymentKey,
        orderId: order.id,
        amount: order.amountKrw,
      });
      const paid = await markOrderPaid({
        orderId: order.id,
        externalPaymentKey: body.paymentKey,
        receiptUrl: tossResult.receipt?.url,
      });
      return NextResponse.json({
        ok: true,
        order: paid,
        user,
      });
    }

    if (portonePaymentId) {
      const payment = await fetchPortOnePayment(portonePaymentId);
      if (!payment) {
        return NextResponse.json(
          { error: "portone_secret_missing" },
          { status: 500 }
        );
      }
      const status = (payment.status || "").toUpperCase();
      if (status !== "PAID" && status !== "PARTIAL_PAID") {
        return NextResponse.json(
          { error: `portone_not_paid:${payment.status || "unknown"}` },
          { status: 402 }
        );
      }
      const paidAmount = payment.amount?.total;
      if (typeof paidAmount === "number" && paidAmount !== order.amountKrw) {
        return NextResponse.json(
          { error: "portone_amount_mismatch" },
          { status: 400 }
        );
      }
      const paid = await markOrderPaid({
        orderId: order.id,
        externalPaymentKey: portonePaymentId,
        paymentMethodLabel: "PortOne KG Inicis (one-time)",
      });
      return NextResponse.json({
        ok: true,
        order: paid,
        user,
      });
    }

    if ((provider === "demo" || body.demo) && isDemoCheckoutAllowed()) {
      const paid = await markOrderPaid({
        orderId: order.id,
        externalPaymentKey: `demo_${Date.now()}`,
      });
      return NextResponse.json({
        ok: true,
        order: paid,
        user,
        demo: true,
      });
    }

    return NextResponse.json(
      { error: "awaiting_provider_confirmation", provider },
      { status: 202 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "confirm failed" },
      { status: 400 }
    );
  }
}
