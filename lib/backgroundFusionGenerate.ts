/**
 * Background fusion generate — same /api/generate pipeline as portrait regenerate.
 * Keeps PersonaCreator + ResultWorkspace on one code path.
 */
import { apiFetchJson } from "@/lib/apiFetch";
import {
  buildFaceConsistencyPayload,
  validateRegenerateDualReference,
} from "@/lib/faceConsistency";
import { prepareGenerateImageUrls } from "@/lib/prepareGenerateImages";

export type BackgroundFusionInput = {
  keyword: string;
  selfieSources: string[];
  sourceDraft: string;
  aspectRatio: string;
  styleIds: string[];
  fusionPrompt: string;
  backgroundScene: string;
  /** Preserved when server rebuilds prompt via CommandRouter. */
  additionalPrompt?: string;
  userMessages?: {
    missingSelfies?: string;
    missingDraft?: string;
    invalidUrls?: string;
  };
};

export type BackgroundFusionResult = {
  imageUrl: string;
  creditsAfter?: number;
  ledgerId?: string | null;
};

export class BackgroundFusionError extends Error {
  code: string;
  status?: number;

  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = "BackgroundFusionError";
    this.code = opts?.code ?? "generation_failed";
    this.status = opts?.status;
  }
}

export async function runBackgroundFusionGenerate(
  input: BackgroundFusionInput
): Promise<BackgroundFusionResult> {
  const keyword = input.keyword.trim();
  if (!keyword) {
    throw new BackgroundFusionError("키워드를 입력해 주세요.", {
      code: "prompt_required",
    });
  }

  const providerSelfies = await prepareGenerateImageUrls(input.selfieSources);
  const [providerDraft] = await prepareGenerateImageUrls([input.sourceDraft], {
    maxImages: 1,
  });

  const dualRef = validateRegenerateDualReference({
    selfieUrls: providerSelfies,
    draftUrl: providerDraft,
    userMessages: input.userMessages,
  });
  if (!dualRef.ok) {
    throw new BackgroundFusionError(dualRef.message, { code: dualRef.code });
  }

  const facePayload = buildFaceConsistencyPayload({
    mode: "regenerate",
    selfieUrls: dualRef.selfieUrls,
    draftUrl: dualRef.draftUrl,
    prompt: input.fusionPrompt,
    backgroundScene: input.backgroundScene,
    backgroundKeyword: keyword,
    additionalPrompt: input.additionalPrompt,
    fusionMode: "full_rerender",
    aspectRatio: input.aspectRatio,
    styleIds: input.styleIds,
  });

  console.info("[backgroundFusion] POST /api/generate", {
    keyword,
    selfieCount: dualRef.selfieUrls.length,
    hasDraft: Boolean(dualRef.draftUrl),
    aspectRatio: input.aspectRatio,
    styleIds: input.styleIds,
  });

  const result = await apiFetchJson<{
    imageUrls?: string[];
    error?: string;
    ledgerId?: string | null;
    creditsAfter?: number;
    message?: string;
  }>("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(facePayload),
  });

  if (result.error === "network" || result.status === 0) {
    throw new BackgroundFusionError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", {
      code: "network",
      status: result.status,
    });
  }

  if (result.status === 402) {
    throw new BackgroundFusionError("생성을 진행할 수 없습니다. 잠시 후 다시 시도해 주세요.", {
      code: "generation_blocked",
      status: 402,
    });
  }

  const data = result.data;
  if (!result.ok || !data?.imageUrls?.length) {
    const serverMessage =
      typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : typeof data?.error === "string" && data.error.trim()
          ? data.error.trim()
          : "AI 배경 생성에 실패했습니다.";
    throw new BackgroundFusionError(serverMessage, {
      code: data?.error || "generation_failed",
      status: result.status,
    });
  }

  const imageUrl = data.imageUrls[0]!.trim();
  if (!imageUrl) {
    throw new BackgroundFusionError("생성된 이미지 URL을 받지 못했습니다.", {
      code: "invalid_image_url",
    });
  }

  return {
    imageUrl,
    creditsAfter: data.creditsAfter,
    ledgerId: data.ledgerId,
  };
}
