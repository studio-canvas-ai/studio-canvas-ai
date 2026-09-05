/**
 * Multilingual background keyword → English scene for Flux Kontext fusion.
 * Same CommandRouter path as /api/ai-background (뚝딱 생성기).
 */
import { CONCEPT_POSE_HINTS } from "@/lib/data";
import type { FaceConsistencyPayload } from "@/lib/faceConsistency";
import { isFluxSafeEnglishPrompt } from "@/lib/ai/commandParser";
import { buildPortraitFusionPrompt } from "@/lib/ai/fusionPrompt";
import { applyVisualOnlyPolicy } from "@/lib/ai/layerPolicy";
import { CommandRouter } from "@/lib/ai/intentRouter";

const FALLBACK_SCENE_EN =
  "photorealistic outdoor environment with natural daylight and atmospheric depth";

/**
 * Route Korean/multilingual keywords to Flux-safe English, then rebuild the
 * full harmonization prompt for background fusion regenerate.
 */
export async function enhanceBackgroundFusionPayload(
  payload: FaceConsistencyPayload
): Promise<FaceConsistencyPayload> {
  const rawKeyword = (
    payload.backgroundKeyword ||
    payload.backgroundScene ||
    ""
  ).trim();

  if (!rawKeyword) return payload;
  if (payload.fusionMode !== "full_rerender") return payload;

  const needsRoute =
    Boolean(payload.backgroundKeyword?.trim()) ||
    !isFluxSafeEnglishPrompt(rawKeyword);

  let englishScene = rawKeyword;

  if (needsRoute) {
    const styleId = payload.styleIds?.[0];
    const routed = await CommandRouter(rawKeyword, {
      styleSelection: {
        imageStyleId: styleId ?? null,
        moodStyleId: null,
      },
    });
    const candidate = applyVisualOnlyPolicy(routed.englishPrompt.trim());
    if (candidate && isFluxSafeEnglishPrompt(candidate)) {
      englishScene = candidate;
    } else if (isFluxSafeEnglishPrompt(rawKeyword)) {
      englishScene = rawKeyword;
    } else {
      console.warn("[routeBackgroundScene] CommandRouter fallback", {
        requestId: routed.requestId,
        routerError: routed.routerError?.code,
        rawPreview: rawKeyword.slice(0, 60),
      });
      englishScene = FALLBACK_SCENE_EN;
    }
  }

  payload.backgroundScene = englishScene;

  const styleId = payload.styleIds?.[0];
  payload.prompt = buildPortraitFusionPrompt({
    styleIds: payload.styleIds,
    backgroundScene: englishScene,
    userPrompt: payload.additionalPrompt,
    poseHint: styleId
      ? CONCEPT_POSE_HINTS[styleId as keyof typeof CONCEPT_POSE_HINTS]
      : undefined,
    harmonize: true,
  });

  console.info("[routeBackgroundScene] enhanced fusion prompt", {
    rawKeyword: rawKeyword.slice(0, 80),
    englishScene: englishScene.slice(0, 120),
    promptLen: payload.prompt.length,
  });

  return payload;
}
