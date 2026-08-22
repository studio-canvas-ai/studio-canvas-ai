import { NextResponse } from "next/server";
import {
  deleteUserFaceProfile,
  listUserFaceProfiles,
  upsertUserFaceProfile,
} from "@/lib/db/faceProfiles";
import { resolveAppUser } from "@/lib/resolveAppUser";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET — list AI training model profiles for the signed-in user. */
export async function GET(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, profiles: [] },
      {
        status: resolved.status,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }

  const profiles = await listUserFaceProfiles(resolved.user.id);
  return NextResponse.json(
    {
      ok: true,
      profiles: profiles.map((p) => ({
        id: p.id,
        name: p.name,
        slot: p.slot,
        photoUrls: p.photoUrls,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

/** POST — upsert one face/object training profile (photos → R2 URLs). */
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
  const name = String(body.name ?? "").trim();
  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

  if (!id || !name || photoUrls.length < 1) {
    return NextResponse.json(
      { error: "id_name_photos_required" },
      { status: 400 }
    );
  }

  try {
    const profile = await upsertUserFaceProfile(resolved.user.id, {
      id,
      name,
      slot: typeof body.slot === "number" ? body.slot : 1,
      photoUrls,
      createdAt: typeof body.createdAt === "number" ? body.createdAt : undefined,
      updatedAt: Date.now(),
    });
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("[face-profiles/upsert]", err);
    return NextResponse.json(
      { error: "upsert_failed", message: "Failed to save model profile" },
      { status: 500 }
    );
  }
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

  const ok = await deleteUserFaceProfile(resolved.user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id });
}
