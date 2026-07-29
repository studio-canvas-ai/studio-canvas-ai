import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import {
  bulkCreatePromotionCodes,
  listPromotionAdminData,
  PROMOTION_CREDIT_OPTIONS,
} from "@/lib/promotions";
import type { PromotionCreditOption } from "@/lib/db/types";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(listPromotionAdminData());
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json()) as {
    creditAmount?: PromotionCreditOption;
    quantity?: number;
  };
  if (
    !body.creditAmount ||
    !PROMOTION_CREDIT_OPTIONS.includes(body.creditAmount) ||
    !body.quantity
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    const result = await bulkCreatePromotionCodes({
      creditAmount: body.creditAmount,
      quantity: body.quantity,
      createdBy: session.user.email,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "generation_failed" },
      { status: 400 }
    );
  }
}
