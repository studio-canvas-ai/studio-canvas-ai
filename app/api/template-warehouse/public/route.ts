import { NextResponse } from "next/server";
import { listTemplate03Public } from "@/lib/template03Public";

export const runtime = "nodejs";

/** GET — public Template 03 warehouse catalog (PII already masked at promote). */
export async function GET(req: Request) {
  const limitRaw = new URL(req.url).searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 200;
  try {
    const items = await listTemplate03Public(limit);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[api/template-warehouse/public] GET", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
