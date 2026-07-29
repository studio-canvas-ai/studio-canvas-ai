import { NextResponse } from "next/server";
import { PROMO_COOKIE_NAME } from "@/lib/promotions";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(PROMO_COOKIE_NAME);
  return response;
}
