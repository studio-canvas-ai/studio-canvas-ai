import { NextResponse } from "next/server";
import {
  deleteUserGalleryWork,
  listUserGalleryWorks,
  upsertUserGalleryWork,
} from "@/lib/db/galleryWorks";
import { resolveAppUser } from "@/lib/resolveAppUser";

export const runtime = "nodejs";

/** GET — finished works for the signed-in user (R2/manifest backed). */
export async function GET(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, works: [] },
      { status: resolved.status }
    );
  }

  const works = await listUserGalleryWorks(resolved.user.id);
  return NextResponse.json({
    ok: true,
    works: works.map((w) => ({
      id: w.id,
      imageUrl: w.imageUrl,
      thumbnailUrl: w.thumbnailUrl ?? w.imageUrl,
      originalKey: w.originalKey,
      storageId: w.storageId ?? w.id,
      createdAt: w.createdAt,
      styleId: w.styleId,
      profileId: w.profileId,
      profileName: w.profileName,
      selfieUrls: Array.isArray(w.selfieUrls) ? w.selfieUrls.slice(0, 10) : undefined,
      expiresAt: w.expiresAt ?? null,
      planAtCreation: w.planAtCreation,
    })),
  });
}

/** POST — upsert a finished work metadata row (images already on R2/CDN). */
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

  const id = String(body.id ?? "").trim();
  const imageUrl = String(body.imageUrl ?? "").trim();
  if (!id || !imageUrl) {
    return NextResponse.json(
      { error: "id_and_imageUrl_required" },
      { status: 400 }
    );
  }

  const work = await upsertUserGalleryWork(resolved.user.id, {
    id,
    imageUrl,
    thumbnailUrl:
      typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : imageUrl,
    originalKey:
      typeof body.originalKey === "string" ? body.originalKey : undefined,
    storageId:
      typeof body.storageId === "string" ? body.storageId : id,
    createdAt:
      typeof body.createdAt === "number" ? body.createdAt : Date.now(),
    styleId: typeof body.styleId === "string" ? body.styleId : undefined,
    profileId: typeof body.profileId === "string" ? body.profileId : undefined,
    profileName:
      typeof body.profileName === "string" ? body.profileName : undefined,
    selfieUrls: Array.isArray(body.selfieUrls)
      ? body.selfieUrls
          .filter((u): u is string => typeof u === "string" && u.trim().length > 8)
          .slice(0, 10)
      : undefined,
    expiresAt:
      body.expiresAt === null
        ? null
        : typeof body.expiresAt === "number"
          ? body.expiresAt
          : null,
    planAtCreation:
      typeof body.planAtCreation === "string" ? body.planAtCreation : undefined,
  });

  return NextResponse.json({ ok: true, work });
}

/** DELETE — ?id= */
export async function DELETE(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await deleteUserGalleryWork(resolved.user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id });
}
