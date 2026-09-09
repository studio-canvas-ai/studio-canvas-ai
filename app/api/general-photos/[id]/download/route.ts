import { NextResponse } from "next/server";
import { debitCredits } from "@/lib/db/credits";
import {
  getGeneralPhotoDownloadCount,
  getUserGeneralPhoto,
  incrementGeneralPhotoDownloadCount,
} from "@/lib/db/generalPhotos";
import {
  FREE_GENERAL_PHOTO_DOWNLOAD_CREDIT_COST,
  FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT,
  isFreeGeneralPhotoPlan,
} from "@/lib/generalPhotoPolicy";
import { checkDownloadRateLimit } from "@/lib/rateLimit";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { hasUnlimitedCredits } from "@/lib/unlimitedAccount";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Authorize + (for free plan) debit 1 credit / count toward the 3-download cap,
 * then return a durable image URL for the client to save.
 */
export async function POST(req: Request, { params }: Params) {
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

  const user = resolved.user;
  const rl = checkDownloadRateLimit(req, user.id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: rl.resetAt },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  const photo = await getUserGeneralPhoto(user.id, id.trim());
  if (!photo) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const freePlan = isFreeGeneralPhotoPlan(user.planId);
  const unlimited = hasUnlimitedCredits(user.email);
  let creditsAfter = user.credits;
  let downloadCount = await getGeneralPhotoDownloadCount(user.id);

  if (freePlan && !unlimited) {
    if (downloadCount >= FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT) {
      return NextResponse.json(
        {
          error: "download_quota_exhausted",
          message:
            "저장 공간/다운로드 횟수가 가득 찼습니다. 불필요한 사진을 정리하거나 크레딧을 확인해 주세요.",
          downloadCount,
          downloadLimit: FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT,
        },
        { status: 403 }
      );
    }

    const debit = await debitCredits({
      userId: user.id,
      amount: FREE_GENERAL_PHOTO_DOWNLOAD_CREDIT_COST,
      reason: "general_photo_download",
      meta: { photoId: photo.id },
    });

    if (!debit.ok) {
      if (debit.reason === "insufficient") {
        return NextResponse.json(
          {
            error: "insufficient_credits",
            message: "Insufficient credits for download.",
            credits: debit.credits ?? 0,
          },
          { status: 402 }
        );
      }
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    creditsAfter = debit.user.credits;
    downloadCount = await incrementGeneralPhotoDownloadCount(user.id);
  }

  return NextResponse.json({
    ok: true,
    id: photo.id,
    imageUrl: photo.imageUrl,
    name: photo.name,
    creditsAfter,
    downloadCount: freePlan ? downloadCount : null,
    downloadLimit: freePlan ? FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT : null,
    downloadRemaining: freePlan
      ? Math.max(0, FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT - downloadCount)
      : null,
    creditCharged:
      freePlan && !unlimited ? FREE_GENERAL_PHOTO_DOWNLOAD_CREDIT_COST : 0,
  });
}
