import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPaymentHistory } from "@/lib/payments";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const orders = await getUserPaymentHistory(userId);
  return NextResponse.json({
    receipts: orders.map((o) => ({
      id: o.id,
      kind: o.kind,
      planId: o.planId ?? null,
      packId: o.packId ?? null,
      amountUsd: o.amountUsd,
      amountKrw: o.amountKrw,
      currency: o.currency,
      credits: o.credits,
      paidAt: o.paidAt ?? o.createdAt,
      receiptUrl: o.receiptUrl ?? null,
      provider: o.provider,
    })),
  });
}
