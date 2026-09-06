/**
 * Client for Screen-26 `/api/generate-photo-ai` (FaceID InstantID).
 */

import { prepareGenerateImageUrls } from "@/lib/prepareGenerateImages";
import type { PortraitAiPurposeUseId } from "@/lib/printPortraitPurpose";

export type GeneratePhotoAiResult = {
  imageUrl: string;
  requestId?: string;
  amount?: number;
  remaining?: number;
};

export async function requestGeneratePhotoAi(opts: {
  identityUrl: string;
  purpose: PortraitAiPurposeUseId;
  prompt: string;
}): Promise<GeneratePhotoAiResult> {
  const identity = (opts.identityUrl || "").trim();
  if (!identity) {
    throw new Error(
      "사진을 먼저 업로드해 주세요. 얼굴이 보이는 원본 이미지가 필요합니다."
    );
  }

  const [faceHttps] = await prepareGenerateImageUrls([identity], {
    maxImages: 1,
  });
  if (
    !faceHttps ||
    (!/^https:\/\//i.test(faceHttps) && !faceHttps.startsWith("data:"))
  ) {
    throw new Error(
      "사진 업로드에 실패했습니다. 이미지를 다시 올려 주세요."
    );
  }

  const clientRequestId = `pa_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const res = await fetch("/api/generate-photo-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      imageUrl: faceHttps,
      faceImageUrl: faceHttps,
      mode: opts.purpose,
      purpose: opts.purpose,
      prompt: opts.prompt.trim(),
      clientRequestId,
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    imageUrl?: string;
    message?: string;
    error?: string;
    requestId?: string;
    amount?: number;
    remaining?: number;
  } | null;

  if (
    !res.ok ||
    !data?.ok ||
    !data.imageUrl ||
    !/^https:\/\//i.test(data.imageUrl)
  ) {
    throw new Error(
      data?.message ||
        data?.error ||
        (res.status === 402
          ? "크레딧이 부족합니다. AI 인물 생성에 필요한 크레딧을 확인해 주세요."
          : "AI 인물 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.")
    );
  }

  return {
    imageUrl: data.imageUrl.trim(),
    requestId: data.requestId,
    amount: data.amount,
    remaining: data.remaining,
  };
}
