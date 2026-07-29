/**
 * Face consistency control stack (#105, #106).
 * Maximizes selfie→draft→regenerate identity lock via InsightFace / IP-Adapter / ControlNet.
 */
import { REGENERATE_CREDIT_COST } from "@/lib/data";

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

export type FaceConsistencyMode = "initial" | "regenerate";

export type FaceConsistencyPayload = {
  mode: FaceConsistencyMode;
  creditCost: number;
  selfieUrls: string[];
  draftUrl?: string;
  prompt: string;
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
  aspectRatio: string;
  styleIds: string[];
}): FaceConsistencyPayload {
  const isRegen = input.mode === "regenerate";
  return {
    mode: input.mode,
    creditCost: isRegen ? REGENERATE_CREDIT_COST : 1,
    selfieUrls: input.selfieUrls.slice(0, 10),
    draftUrl: isRegen ? input.draftUrl : undefined,
    prompt: input.prompt.trim(),
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
