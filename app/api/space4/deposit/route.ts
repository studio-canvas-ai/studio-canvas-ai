import { NextResponse } from "next/server";
import { depositSpace4Record } from "@/lib/space4Vault";
import { resolveAppUser } from "@/lib/resolveAppUser";

export const runtime = "nodejs";

/**
 * POST — any authenticated user deposits sealed .sca into Space 4 (operator vault).
 * Listing remains admin-only via /api/admin/space4.
 */
export async function POST(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sealedContent = String(body.sealedContent ?? "").trim();
  if (!sealedContent || !sealedContent.includes("SCAENC1")) {
    return NextResponse.json(
      { error: "sealedContent_required" },
      { status: 400 }
    );
  }

  try {
    const record = await depositSpace4Record({
      userId: resolved.user.id,
      label: typeof body.label === "string" ? body.label : "통합 에디터 다운로드",
      mode: body.mode === "utility" ? "utility" : "agent",
      sealedContent,
      createdAt: typeof body.createdAt === "number" ? body.createdAt : Date.now(),
      source:
        typeof body.source === "string" ? body.source : "print-unified-editor",
      thumbSrc: typeof body.thumbSrc === "string" ? body.thumbSrc : null,
    });
    return NextResponse.json({
      ok: true,
      id: record.id,
      createdAt: record.createdAt,
    });
  } catch (err) {
    console.error("[api/space4/deposit] POST", err);
    return NextResponse.json({ error: "deposit_failed" }, { status: 500 });
  }
}
