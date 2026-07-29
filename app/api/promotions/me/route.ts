import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPromotionByToken, PROMO_COOKIE_NAME } from "@/lib/promotions";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const item = getPromotionByToken(cookieStore.get(PROMO_COOKIE_NAME)?.value);
  if (!item) {
    const response = NextResponse.json({ active: false, wallet: null });
    response.cookies.delete(PROMO_COOKIE_NAME);
    return response;
  }
  return NextResponse.json({
    active: true,
    wallet: {
      remainingCredits: item.remainingCredits,
      expiresAt: item.expiresAt,
      codeSuffix: item.codeSuffix,
    },
  });
}
