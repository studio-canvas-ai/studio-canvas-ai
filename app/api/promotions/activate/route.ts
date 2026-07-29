import { NextResponse } from "next/server";
import {
  activatePromotionCode,
  createPromotionCookieToken,
  PROMO_COOKIE_NAME,
} from "@/lib/promotions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { code?: string };
  if (!body.code?.trim()) {
    return NextResponse.json({ error: "code_required" }, { status: 400 });
  }
  const result = await activatePromotionCode(body.code);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === "expired" ? "code_expired" : "invalid_code" },
      { status: result.reason === "expired" ? 410 : 404 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    wallet: {
      remainingCredits: result.promotion.remainingCredits,
      expiresAt: result.promotion.expiresAt,
      codeSuffix: result.promotion.codeSuffix,
    },
  });
  response.cookies.set(
    PROMO_COOKIE_NAME,
    createPromotionCookieToken(result.promotion.id),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(result.promotion.expiresAt),
    }
  );
  return response;
}
