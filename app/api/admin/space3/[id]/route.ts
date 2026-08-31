import { NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/adminAuth";
import { removeTemplate03Public } from "@/lib/template03Public";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE — admin-only removal of a Template 03 public catalog entry. */
export async function DELETE(req: Request, context: RouteContext) {
  const admin = await resolveAdminAccess(req);
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const templateId = String(id ?? "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  try {
    const removed = await removeTemplate03Public(templateId);
    if (!removed) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: templateId });
  } catch (err) {
    console.error("[api/admin/space3/[id]] DELETE", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
