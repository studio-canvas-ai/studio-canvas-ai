import { NextResponse } from "next/server";
import {
  deleteUserGeneralPhoto,
  getUserGeneralPhoto,
} from "@/lib/db/generalPhotos";
import { resolveAppUser } from "@/lib/resolveAppUser";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  const photo = await getUserGeneralPhoto(resolved.user.id, id.trim());
  if (!photo) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    photo: {
      id: photo.id,
      imageUrl: photo.imageUrl,
      name: photo.name,
      createdAt: photo.createdAt,
      storageKey: photo.storageKey ?? null,
    },
  });
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  const ok = await deleteUserGeneralPhoto(resolved.user.id, id.trim());
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: id.trim() });
}
