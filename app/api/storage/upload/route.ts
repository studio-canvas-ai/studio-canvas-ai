import { NextResponse } from "next/server";
import {
  buildManifest,
  originalKeyFor,
  saveStorageManifest,
  thumbKeyFor,
} from "@/lib/storageManifest";
import { createGalleryThumbnail, normalizeOriginal } from "@/lib/imagePipeline";
import {
  createR2Client,
  getR2Config,
  isR2Configured,
  publicObjectUrl,
  putR2Object,
} from "@/lib/r2";
import type { PlanId, SubscriptionPlanId } from "@/lib/faceProfiles";
import { retentionContextFromAccount } from "@/lib/retentionPolicy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const id = String(form.get("id") ?? "").trim();
    const planId = (String(form.get("planId") ?? "free") as PlanId) || "free";
    const cancelledAtRaw = form.get("cancelledAt");
    const lastPaidPlan = form.get("lastPaidPlan");

    if (!file || !(file instanceof Blob) || !id) {
      return NextResponse.json({ error: "file and id are required" }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const thumb = await createGalleryThumbnail(input);
    const { buffer: original, contentType } = await normalizeOriginal(input);

    const ctx = retentionContextFromAccount(planId, {
      cancelledAt: cancelledAtRaw ? Number(cancelledAtRaw) : undefined,
      lastPaidPlan: lastPaidPlan
        ? (String(lastPaidPlan) as SubscriptionPlanId)
        : undefined,
    });

    if (!isR2Configured()) {
      const thumbDataUrl = `data:image/webp;base64,${thumb.toString("base64")}`;
      return NextResponse.json({
        id,
        thumbnailUrl: thumbDataUrl,
        imageUrl: thumbDataUrl,
        originalAvailable: false,
        expiresAt: buildManifest(id, planId, ctx, "", "").expiresAt,
      });
    }

    const config = getR2Config()!;
    const client = createR2Client(config);
    const thumbKey = thumbKeyFor(id);
    const origKey = originalKeyFor(id, contentType.includes("png") ? "png" : "jpg");

    await putR2Object(client, config.bucketName, thumbKey, thumb, "image/webp");
    await putR2Object(client, config.bucketName, origKey, original, contentType);

    const manifest = buildManifest(id, planId, ctx, thumbKey, origKey);
    await saveStorageManifest(manifest);

    const thumbnailUrl = publicObjectUrl(config, thumbKey);

    return NextResponse.json({
      id,
      thumbnailUrl,
      imageUrl: thumbnailUrl,
      thumbnailKey: thumbKey,
      originalKey: origKey,
      storageId: id,
      originalAvailable: true,
      expiresAt: manifest.expiresAt,
    });
  } catch (err) {
    console.error("[storage/upload]", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
