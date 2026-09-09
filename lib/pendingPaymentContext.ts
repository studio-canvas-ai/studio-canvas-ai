/** Client-side pending PG context so return URLs can finish confirm. */

const KEY = "sca_pending_payment_v1";

export type PendingPaymentContext = {
  orderId: string;
  issueId?: string;
  checkoutMode?: "recurring_billing_key" | "one_time";
  billingKey?: string;
  paymentId?: string;
  at: number;
};

export function writePendingPaymentContext(ctx: PendingPaymentContext): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...ctx, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function readPendingPaymentContext(): PendingPaymentContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPaymentContext;
    if (!parsed?.orderId) return null;
    if (Date.now() - (parsed.at || 0) > 6 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPaymentContext(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function patchPendingPaymentContext(
  patch: Partial<PendingPaymentContext>
): void {
  const current = readPendingPaymentContext();
  if (!current) return;
  writePendingPaymentContext({ ...current, ...patch, at: Date.now() });
}
