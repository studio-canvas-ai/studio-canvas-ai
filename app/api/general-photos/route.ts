import { NextResponse } from "next/server";
import { ACCEPTED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "@/lib/data";
import {
  addUserGeneralPhoto,
  getGeneralPhotoDownloadCount,
  listUserGeneralPhotos,
} from "@/lib/db/generalPhotos";
import {
  FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT,
  generalPhotoStorageLimit,
  isFreeGeneralPhotoPlan,
} from "@/lib/generalPhotoPolicy";
import { normalizeGeneralPhotoWebp } from "@/lib/imagePipeline";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { collectUserStorageAliases } from "@/lib/studioStore/userAliases";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MIME = new Set<string>([
  ...ACCEPTED_IMAGE_MIME,
  "image/jpg",
  "image/svg+xml",
]);

function extOk(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp", "heic", "heif", "svg", "avif"].includes(
    ext
  );
}

/** GET — list cloud-backed general photos + quota snapshot. */
export async function GET(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, photos: [], quota: null },
      { status: resolved.status }
    );
  }

  const user = resolved.user;
  const aliases = await collectUserStorageAliases(req, user);
  const byId = new Map<
    string,
    Awaited<ReturnType<typeof listUserGeneralPhotos>>[number]
  >();
  for (const alias of aliases) {
    const list = await listUserGeneralPhotos(alias);
    for (const p of list) {
      const prev = byId.get(p.id);
      if (!prev || p.createdAt > prev.createdAt) {
        byId.set(p.id, { ...p, userId: user.id });
      }
    }
  }
  const photos = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  const limit = generalPhotoStorageLimit(user.planId, user.email);
  const downloadCount = await getGeneralPhotoDownloadCount(user.id);
  const freePlan = isFreeGeneralPhotoPlan(user.planId);

  return NextResponse.json({
    ok: true,
    photos: photos.map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      name: p.name,
      createdAt: p.createdAt,
      storageKey: p.storageKey ?? null,
    })),
    quota: {
      planId: user.planId,
      used: photos.length,
      limit,
      remaining: Math.max(0, limit - photos.length),
      freePlan,
      downloadCount: freePlan ? downloadCount : null,
      downloadLimit: freePlan ? FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT : null,
      downloadRemaining: freePlan
        ? Math.max(0, FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT - downloadCount)
        : null,
      downloadCreditCost: freePlan ? 1 : 0,
    },
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** POST — upload one image (multipart) to R2 with plan quota + rate limit. */
export async function POST(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, message: resolved.error },
      { status: resolved.status }
    );
  }

  const user = resolved.user;
  const rl = checkUploadRateLimit(req, user.id);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many uploads. Please try again shortly.",
        resetAt: rl.resetAt,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  const existing = await listUserGeneralPhotos(user.id);
  const limit = generalPhotoStorageLimit(user.planId, user.email);
    if (existing.length >= limit) {
      return NextResponse.json(
        {
          error: "storage_full",
          message:
            "저장 공간이 가득 찼습니다. 불필요한 사진을 삭제한 후 다시 시도해 주세요.",
          quota: { used: existing.length, limit },
        },
        { status: 403 }
      );
    }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  const nameRaw = String(form.get("name") ?? "").trim().slice(0, 120);

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "file_required", message: "file is required" },
      { status: 400 }
    );
  }

  const fileName =
    file instanceof File && file.name ? file.name : nameRaw || "photo.jpg";

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "Max 20MB" },
      { status: 413 }
    );
  }

  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_MIME.has(mime) && !extOk(fileName)) {
    return NextResponse.json(
      { error: "unsupported_type", message: "Unsupported image type" },
      { status: 415 }
    );
  }
  if (!mime && !extOk(fileName)) {
    return NextResponse.json(
      { error: "unsupported_type", message: "Unsupported image type" },
      { status: 415 }
    );
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    let webp: Buffer;
    try {
      webp = await normalizeGeneralPhotoWebp(input);
    } catch (err) {
      console.warn("[general-photos] sharp normalize failed, soft retry", err);
      const sharp = (await import("sharp")).default;
      webp = await sharp(input, { density: 150, failOn: "none" })
        .rotate()
        .resize({
          width: 1920,
          height: 1920,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
    }
    const photo = await addUserGeneralPhoto({
      userId: user.id,
      name: nameRaw || fileName.replace(/\.[^.]+$/, "") || "Photo",
      imageBuffer: webp,
    });

    const photos = await listUserGeneralPhotos(user.id);
    return NextResponse.json({
      ok: true,
      photo: {
        id: photo.id,
        imageUrl: photo.imageUrl,
        name: photo.name,
        createdAt: photo.createdAt,
        storageKey: photo.storageKey ?? null,
      },
      quota: {
        used: photos.length,
        limit,
        remaining: Math.max(0, limit - photos.length),
      },
    });
  } catch (err) {
    console.error("[general-photos/upload]", err);
    const detail = err instanceof Error ? err.message : "Upload failed";
    const authFailed = /unauthorized|invalidaccesskey|signaturedoesnotmatch|invalidargument/i.test(
      detail
    );
    return NextResponse.json(
      {
        error: authFailed ? "storage_auth_failed" : "upload_failed",
        message: authFailed
          ? "Cloud storage authentication failed"
          : "Upload failed",
      },
      { status: authFailed ? 502 : 500 }
    );
  }
}
