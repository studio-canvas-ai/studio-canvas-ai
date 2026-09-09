import { NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/adminAuth";
import { getSpace4Record, removeSpace4Record } from "@/lib/space4Vault";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — admin-only sealed .sca payload for manual review in Screen 26. */
export async function GET(req: Request, context: RouteContext) {
  const admin = await resolveAdminAccess(req);
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const space4Id = String(id ?? "").trim();
  if (!space4Id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  try {
    const vault = await getSpace4Record(space4Id);
    if (!vault) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      id: vault.id,
      label: vault.label,
      mode: vault.mode,
      createdAt: vault.createdAt,
      source: vault.source,
      thumbSrc: vault.thumbSrc ?? null,
      sealedContent: vault.sealedContent,
    });
  } catch (err) {
    console.error("[api/admin/space4/[id]] GET", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

/** DELETE — admin-only removal of a Space 4 vault entry (R2 item + index). */
export async function DELETE(req: Request, context: RouteContext) {
  const admin = await resolveAdminAccess(req);
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const space4Id = String(id ?? "").trim();
  if (!space4Id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  try {
    const removed = await removeSpace4Record(space4Id);
    if (!removed) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: space4Id });
  } catch (err) {
    console.error("[api/admin/space4/[id]] DELETE", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
