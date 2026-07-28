import { NextResponse } from "next/server";
import { loadStorageManifest } from "@/lib/storageManifest";
import { createR2Client, getR2Config, getR2Object } from "@/lib/r2";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** On-demand HD original fetch (#75) — only when user clicks High-Res Download. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const config = getR2Config();
  if (!config) {
    return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  }

  const manifest = await loadStorageManifest(id);
  if (!manifest) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (manifest.originalDeleted) {
    return NextResponse.json({ error: "original expired and deleted" }, { status: 410 });
  }

  if (manifest.expiresAt != null && manifest.expiresAt <= Date.now()) {
    return NextResponse.json({ error: "retention period expired" }, { status: 410 });
  }

  const client = createR2Client(config);
  const buffer = await getR2Object(client, config.bucketName, manifest.originalKey);
  if (!buffer) {
    return NextResponse.json({ error: "original not found" }, { status: 404 });
  }

  const ext = manifest.originalKey.split(".").pop() ?? "jpg";
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="studio-canvas-${id}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
