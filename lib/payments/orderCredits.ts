import type { DbSnapshot, PaymentOrder } from "@/lib/db/types";
import { newId } from "@/lib/db/store";

const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type OrderCreditConsumption = { orderId: string; amount: number };

/** FIFO: consume paid-order credit buckets for Article 6 unused-credit checks. */
export function consumeOrderCreditBuckets(
  db: DbSnapshot,
  userId: string,
  amount: number
): OrderCreditConsumption[] {
  if (amount <= 0) return [];
  const orders = Object.values(db.orders)
    .filter(
      (o) =>
        o.userId === userId &&
        o.status === "paid" &&
        (o.creditsRemaining ?? 0) > 0
    )
    .sort((a, b) => (a.paidAt ?? a.createdAt) - (b.paidAt ?? b.createdAt));

  let left = amount;
  const consumed: OrderCreditConsumption[] = [];
  for (const order of orders) {
    if (left <= 0) break;
    const available = order.creditsRemaining ?? 0;
    if (available <= 0) continue;
    const take = Math.min(available, left);
    order.creditsRemaining = Math.round((available - take) * 10) / 10;
    consumed.push({ orderId: order.id, amount: take });
    left = Math.round((left - take) * 10) / 10;
  }
  return consumed;
}

/** Restore buckets after a failed generation credit refund (LIFO). */
export function restoreOrderCreditBuckets(
  db: DbSnapshot,
  consumptions: OrderCreditConsumption[]
): void {
  for (let i = consumptions.length - 1; i >= 0; i--) {
    const item = consumptions[i]!;
    const order = db.orders[item.orderId];
    if (!order || order.status !== "paid") continue;
    const current = order.creditsRemaining ?? 0;
    const capped = Math.min(order.credits, Math.round((current + item.amount) * 10) / 10);
    order.creditsRemaining = capped;
  }
}

export function parseConsumptionsMeta(
  meta?: Record<string, string | number | boolean | null>
): OrderCreditConsumption[] {
  const raw = meta?.orderConsumptions;
  if (typeof raw !== "string" || !raw) return [];
  return raw
    .split(",")
    .map((part) => {
      const [orderId, amountRaw] = part.split(":");
      const amount = Number(amountRaw);
      if (!orderId || !Number.isFinite(amount) || amount <= 0) return null;
      return { orderId, amount };
    })
    .filter((x): x is OrderCreditConsumption => Boolean(x));
}

export function serializeConsumptionsMeta(
  consumptions: OrderCreditConsumption[]
): string {
  return consumptions.map((c) => `${c.orderId}:${c.amount}`).join(",");
}

export function isWithinRefundWindow(order: PaymentOrder, now = Date.now()): boolean {
  if (!order.paidAt) return false;
  return now - order.paidAt <= REFUND_WINDOW_MS;
}

export function orderCreditsFullyUnused(order: PaymentOrder): boolean {
  const remaining = order.creditsRemaining ?? order.credits;
  return remaining + 1e-9 >= order.credits;
}

export function createLedgerId() {
  return newId("ldg");
}

export { REFUND_WINDOW_MS };
