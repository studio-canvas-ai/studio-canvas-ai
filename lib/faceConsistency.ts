/**
 * Face consistency control stack (#105, #106).
 * Maximizes selfie→draft→regenerate identity lock via InsightFace / IP-Adapter / ControlNet.
 */
import { REGENERATE_CREDIT_COST, TRAIN_CREDIT_COST, GENERATE_CREDIT_COST } from "@/lib/data";

export const FACE_ID_EXTRACTOR = {
  engine: "insightface" as const,
  model: "buffalo_l",
  detectThreshold: 0.5,
  /** Maximize face embedding strength for identity lock */
  faceWeight: 1.0,
  landmarkWeight: 1.0,
  embedDim: 512,
};

export const IP_ADAPTER_FACE = {
  enabled: true,
  /** Face ID / IP-Adapter-FaceID weight — max for identity preservation */
  faceIdWeight: 1.0,
  styleWeight: 0.15,
  scale: 1.0,
  plus: true,
};

export const CONTROLNET_FACE_LOCK = {
  enabled: true,
  /** Soft face mask: keep identity, allow bg/clothing edits */
  identityMaskStrength: 1.0,
  openposeFace: true,
  referenceOnly: true,
  conditioningScale: 1.0,
};

export const DUAL_REFERENCE = {
  /** Selfie originals always primary identity ref */
  selfieWeight: 1.0,
  /** Selected draft anchors composition while face stays locked to selfie */
  draftWeight: 0.85,
  preserveIdentity: true,
  allowBackgroundSwap: true,
  allowWardrobeSwap: true,
  allowExpressionHint: true,
};

export type FaceConsistencyMode = "initial" | "regenerate" | "train";

/** How regenerate chooses the Kontext base image. */
export type FusionRenderMode = "full_rerender" | "edit_draft";

export type FaceConsistencyPayload = {
  mode: FaceConsistencyMode;
  creditCost: number;
  selfieUrls: string[];
  draftUrl?: string;
  prompt: string;
  /** Scene / background keywords from step 3 or detail-view AI bar. */
  backgroundScene?: string;
  /** Raw user keyword (Korean OK) — server routes via CommandRouter before inference. */
  backgroundKeyword?: string;
  /** Extra user direction preserved when server rebuilds fusion prompt. */
  additionalPrompt?: string;
  /** full_rerender = selfie base + unified fusion; edit_draft = refine existing draft. */
  fusionMode?: FusionRenderMode;
  aspectRatio: string;
  styleIds: string[];
  faceId: typeof FACE_ID_EXTRACTOR;
  ipAdapter: typeof IP_ADAPTER_FACE;
  controlNet: typeof CONTROLNET_FACE_LOCK;
  dualReference: typeof DUAL_REFERENCE | null;
  identityLock: {
    enforceSameFace: true;
    maxIdentityDrift: 0;
    facialLandmarksFreeze: true;
    jawlineFreeze: true;
    featurePointsFreeze: true;
  };
};

/** Build generation / regenerate request with max face-consistency stack. */
export function buildFaceConsistencyPayload(input: {
  mode: FaceConsistencyMode;
  selfieUrls: string[];
  draftUrl?: string;
  prompt: string;
  backgroundScene?: string;
  backgroundKeyword?: string;
  additionalPrompt?: string;
  fusionMode?: FusionRenderMode;
  aspectRatio: string;
  styleIds: string[];
}): FaceConsistencyPayload {
  const isRegen = input.mode === "regenerate";
  const isTrain = input.mode === "train";
  const fusionMode: FusionRenderMode =
    input.fusionMode ?? (isRegen ? "edit_draft" : "full_rerender");
  return {
    mode: input.mode,
    creditCost: isRegen
      ? REGENERATE_CREDIT_COST
      : isTrain
        ? TRAIN_CREDIT_COST
        : GENERATE_CREDIT_COST,
    selfieUrls: input.selfieUrls.slice(0, 10),
    draftUrl: isRegen ? input.draftUrl : undefined,
    prompt: input.prompt.trim(),
    backgroundScene: (input.backgroundScene || "").trim() || undefined,
    backgroundKeyword: (input.backgroundKeyword || "").trim() || undefined,
    additionalPrompt: (input.additionalPrompt || "").trim() || undefined,
    fusionMode,
    aspectRatio: input.aspectRatio,
    styleIds: input.styleIds,
    faceId: { ...FACE_ID_EXTRACTOR, faceWeight: 1.0 },
    ipAdapter: { ...IP_ADAPTER_FACE, faceIdWeight: 1.0, scale: 1.0 },
    controlNet: {
      ...CONTROLNET_FACE_LOCK,
      identityMaskStrength: 1.0,
      conditioningScale: 1.0,
    },
    dualReference: isRegen
      ? {
          ...DUAL_REFERENCE,
          selfieWeight: 1.0,
          draftWeight: 0.85,
          preserveIdentity: true,
        }
      : null,
    identityLock: {
      enforceSameFace: true,
      maxIdentityDrift: 0,
      facialLandmarksFreeze: true,
      jawlineFreeze: true,
      featurePointsFreeze: true,
    },
  };
}

function clamp01(n: unknown, fallback = 1): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(1, v));
}

const DEFAULT_DUAL_REF_MESSAGES = {
  missingSelfies:
    "학습된 인물 사진이 필요합니다. AI 학습용 사진을 등록하거나 업로드해 주세요.",
  missingDraft:
    "시안 이미지가 필요합니다. 시안 1 또는 시안 2를 먼저 선택해 주세요.",
  invalidUrls:
    "이미지 URL이 유효하지 않습니다. 사진을 다시 업로드한 뒤 시도해 주세요.",
} as const;

/** Server/client-safe URL check for generate dual-reference payloads. */
export function isReachableGenerateImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("blob:")) return false;
  return (
    /^https:\/\//i.test(trimmed) || trimmed.startsWith("data:image/")
  );
}

export type DualReferenceValidation =
  | { ok: true; selfieUrls: string[]; draftUrl: string }
  | {
      ok: false;
      code: "missing_selfies" | "missing_draft" | "invalid_urls";
      message: string;
    };

/** Validate regenerate dual-reference (`selfieUrls` + `draftUrl`) before /api/generate. */
export function validateRegenerateDualReference(input: {
  selfieUrls?: string[];
  draftUrl?: string;
  userMessages?: {
    missingSelfies?: string;
    missingDraft?: string;
    invalidUrls?: string;
  };
}): DualReferenceValidation {
  const msgs = { ...DEFAULT_DUAL_REF_MESSAGES, ...input.userMessages };
  const selfieUrls = (input.selfieUrls || [])
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);
  const draftUrl = typeof input.draftUrl === "string" ? input.draftUrl.trim() : "";

  if (!selfieUrls.length) {
    return { ok: false, code: "missing_selfies", message: msgs.missingSelfies };
  }
  if (!draftUrl) {
    return { ok: false, code: "missing_draft", message: msgs.missingDraft };
  }
  const allUrls = [...selfieUrls, draftUrl];
  if (!allUrls.every(isReachableGenerateImageUrl)) {
    return { ok: false, code: "invalid_urls", message: msgs.invalidUrls };
  }

  return { ok: true, selfieUrls, draftUrl };
}

/**
 * Sanitize a client-posted payload so face-consistency knobs never drop below
 * the identity-lock floor required by /api/generate + GPU workers.
 */
export function normalizeFaceConsistencyPayload(
  raw: Partial<FaceConsistencyPayload> & {
    mode?: FaceConsistencyMode;
    selfieUrls?: string[];
    prompt?: string;
    aspectRatio?: string;
    styleIds?: string[];
  }
): FaceConsistencyPayload {
  const mode: FaceConsistencyMode =
    raw.mode === "regenerate"
      ? "regenerate"
      : raw.mode === "train"
        ? "train"
        : "initial";
  const base = buildFaceConsistencyPayload({
    mode,
    selfieUrls: Array.isArray(raw.selfieUrls) ? raw.selfieUrls : [],
    draftUrl: typeof raw.draftUrl === "string" ? raw.draftUrl : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : "",
    backgroundScene:
      typeof raw.backgroundScene === "string" ? raw.backgroundScene : undefined,
    fusionMode:
      raw.fusionMode === "full_rerender" || raw.fusionMode === "edit_draft"
        ? raw.fusionMode
        : undefined,
    aspectRatio:
      typeof raw.aspectRatio === "string" && raw.aspectRatio
        ? raw.aspectRatio
        : "9:16",
    styleIds: Array.isArray(raw.styleIds) ? raw.styleIds.filter(Boolean) : [],
  });

  if (typeof raw.backgroundKeyword === "string" && raw.backgroundKeyword.trim()) {
    base.backgroundKeyword = raw.backgroundKeyword.trim();
  }
  if (typeof raw.additionalPrompt === "string" && raw.additionalPrompt.trim()) {
    base.additionalPrompt = raw.additionalPrompt.trim();
  }

  // Floor weights at 1.0 so free / premium paths share the same identity lock.
  base.faceId.faceWeight = Math.max(1, clamp01(raw.faceId?.faceWeight, 1));
  base.faceId.landmarkWeight = Math.max(
    1,
    clamp01(raw.faceId?.landmarkWeight, 1)
  );
  base.ipAdapter.faceIdWeight = Math.max(
    1,
    clamp01(raw.ipAdapter?.faceIdWeight, 1)
  );
  base.ipAdapter.scale = Math.max(1, clamp01(raw.ipAdapter?.scale, 1));
  base.controlNet.identityMaskStrength = Math.max(
    1,
    clamp01(raw.controlNet?.identityMaskStrength, 1)
  );
  base.controlNet.conditioningScale = Math.max(
    1,
    clamp01(raw.controlNet?.conditioningScale, 1)
  );

  return base;
}
