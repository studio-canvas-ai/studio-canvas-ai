import { NextResponse } from "next/server";
import {
  loadShareMetaById,
  resolveShareImageUrl,
} from "@/lib/shareImageStore.server";
import { sanitizeShareId } from "@/lib/shareImageStore";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Public share metadata for the mobile viewer page. */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = sanitizeShareId(rawId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
    }

    const meta = await loadShareMetaById(id);
    if (!meta) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const imageUrl = await resolveShareImageUrl(meta);

    return NextResponse.json({
      ok: true,
      id: meta.id,
      title: meta.title,
      description: meta.description,
      contentType: meta.contentType,
      imageUrl,
      createdAt: meta.createdAt,
    });
  } catch (err) {
    console.error("[share/id]", err);
    return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
  }
}
