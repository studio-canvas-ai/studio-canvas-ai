import { NextResponse } from "next/server";
import { getBusinessInfo, isBusinessInfoComplete } from "@/lib/business";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ...getBusinessInfo(),
    complete: isBusinessInfoComplete(),
  });
}
