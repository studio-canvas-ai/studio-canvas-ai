import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { listSpace4Records } from "@/lib/space4Vault";

export const runtime = "nodejs";

/** GET — admin-only Space 4 vault metadata (no sealed payload). */
export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitRaw = new URL(req.url).searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;
  try {
    const items = await listSpace4Records(limit);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[api/admin/space4] GET", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
