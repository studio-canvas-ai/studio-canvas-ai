/**
 * Photo lookbook dual-layer helpers:
 * scenic background plate (fixed) + independent subject cutout layer (editable).
 */

import {
  processSubjectViaApi,
  requestAiCommand,
  toRawImageUrl,
} from "@/lib/aiCommand";
import { enhanceLookbookScenePrompt } from "@/lib/photoLookbookSceneEnhance";
import { prepareGenerateImageUrls } from "@/lib/prepareGenerateImages";
import {
  createPrintPhotoLayerFromSrc,
  enforceLookbookSubjectMinScale,
  measureOpaqueTrim,
  type PrintPhotoLayer,
} from "@/lib/printWizardPhotoLayers";
import { toDisplayImageSrc } from "@/lib/resultSession";
import { resolveActiveTrainedFace } from "@/lib/photoVaultStorage";

export const LOOKBOOK_SUBJECT_LAYER_ID = "lookbook-subject";

async function requestLookbookFaceId(opts: {
  faceImageUrl: string;
  prompt: string;
  mode: "base_scene" | "subject_studio";
}): Promise<string> {
  const face = (opts.faceImageUrl || "").trim();
  if (!face) {
    throw new Error(
      "Face ID가 없습니다. 학습사진 저장소에서 얼굴을 선택·학습해 주세요."
    );
  }
  const [faceHttps] = await prepareGenerateImageUrls([face], { maxImages: 1 });
  if (!faceHttps || !/^https:\/\//i.test(faceHttps)) {
    throw new Error(
      "Face ID 업로드에 실패했습니다. 학습사진 저장소의 얼굴을 다시 선택해 주세요."
    );
  }

  const clientRequestId = `lb_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const res = await fetch("/api/ai/lookbook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      faceImageUrl: faceHttps,
      prompt: opts.prompt.trim(),
      mode: opts.mode,
      clientRequestId,
      ipAdapterScale: 0.85,
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    imageUrl?: string;
    message?: string;
    error?: string;
    requestId?: string;
  } | null;

  if (!res.ok || !data?.ok || !data.imageUrl || !/^https:\/\//i.test(data.imageUrl)) {
    throw new Error(
      data?.message || data?.error || "화보 FaceID 생성에 실패했습니다."
    );
  }

  console.info("[lookbook] FaceID ok", {
    mode: opts.mode,
    requestId: data.requestId,
    clientRequestId,
  });

  return data.imageUrl.trim();
}

/** Prefer active trained vault face; never trust a generated lookbook layer alone. */
function resolveMandatoryFaceUrl(identityUrl: string): string {
  const active = resolveActiveTrainedFace()?.src?.trim();
  if (active) return active;
  const fallback = identityUrl.trim();
  if (!fallback) {
    throw new Error(
      "Face ID가 없습니다. 학습사진 저장소에서 얼굴을 선택·학습해 주세요."
    );
  }
  return fallback;
}

/** Keep bbox; refresh cutout src + opaque trim. Upsize if below portrait floor. */
export async function replaceSubjectLayerCutout(
  layer: PrintPhotoLayer,
  cutoutSrcInput: string,
  stageW?: number,
  stageH?: number
): Promise<PrintPhotoLayer> {
  const src = toDisplayImageSrc(cutoutSrcInput.trim());
  if (!src) throw new Error("cutout_src_empty");
  const trim = await measureOpaqueTrim(src);
  let next: PrintPhotoLayer = {
    ...layer,
    src,
    photoKind: "cutout",
    trim,
  };
  if (
    typeof stageW === "number" &&
    typeof stageH === "number" &&
    stageW > 0 &&
    stageH > 0
  ) {
    next = enforceLookbookSubjectMinScale(next, stageW, stageH);
  }
  return next;
}

/** @deprecated use enforceLookbookSubjectMinScale from printWizardPhotoLayers */
export { enforceLookbookSubjectMinScale };

/** Build a new centered cutout subject layer (cold start) at portrait scale. */
export async function createLookbookSubjectLayer(
  cutoutHttpsOrDisplay: string,
  stageW: number,
  stageH: number,
  id: string = LOOKBOOK_SUBJECT_LAYER_ID
): Promise<PrintPhotoLayer> {
  const src = toDisplayImageSrc(cutoutHttpsOrDisplay.trim());
  return createPrintPhotoLayerFromSrc(src, {
    mode: "cutout",
    stageW,
    stageH,
    stackIndex: 0,
    id,
    lookbookPortraitScale: true,
  });
}

/** rembg → transparent PNG https URL. */
export async function cutoutLookbookSubject(imageUrl: string): Promise<string> {
  return processSubjectViaApi(toRawImageUrl(imageUrl));
}

/**
 * From a legacy flattened plate: remove people so the plate becomes
 * a reusable scenic background (pixel lock target for later edits).
 */
export async function cleanScenicBackgroundFromPlate(opts: {
  plateUrl: string;
  aspectRatio: string;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
}): Promise<string> {
  const boot = await requestAiCommand({
    command: [
      "EDIT_IMAGE",
      "Remove every person from this photograph completely.",
      "Fill gaps with continuous natural background matching the scenery, lighting, and perspective.",
      "Absolutely no people, no faces, no silhouettes, no mannequins.",
      "Photorealistic empty scenic background only.",
      "Compose as a deep backdrop plate suitable behind a large foreground portrait subject.",
    ].join(" "),
    mode: "utility",
    subjectUrl: toRawImageUrl(opts.plateUrl),
    forceIntent: "edit_image",
    identityLock: false,
    aspectRatio: opts.aspectRatio,
    imageStyleId: opts.imageStyleId,
    moodStyleId: opts.moodStyleId,
  });
  const url =
    boot.actions.find((a) => a.plane === "background")?.imageUrl ||
    boot.actions.find((a) => a.plane === "subject")?.imageUrl ||
    boot.actions[0]?.imageUrl;
  if (!url) {
    throw new Error(boot.message || "배경 분리에 실패했습니다.");
  }
  return url.trim();
}

/** Empty scenic background from prompt (no people). */
export async function generateLookbookScenicBackground(opts: {
  prompt: string;
  aspectRatio: string;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
}): Promise<string> {
  const { enhanced, placeMatched, original } = enhanceLookbookScenePrompt(
    opts.prompt
  );
  console.info("[lookbook-scene-enhance] scenic", {
    placeMatched,
    original: original.slice(0, 80),
    enhanced: enhanced.slice(0, 160),
  });
  const boot = await requestAiCommand({
    command: [
      "GENERATE_BG",
      "Photorealistic empty scenic background only.",
      "No people, no faces, no figures, no mannequins.",
      "Deep environmental plate for a foreground portrait — grand architecture/scenery is fine,",
      "but leave clear central space for a large medium-to-full body subject later.",
      "Do not compose as a distant landscape establishing shot with empty tiny-figure scale.",
      "Honor the location visual details exactly (correct landmark materials, colors, and geography).",
      "Scene description:",
      enhanced || opts.prompt.trim(),
    ].join(" "),
    mode: "utility",
    forceIntent: "generate_bg",
    aspectRatio: opts.aspectRatio,
    imageStyleId: opts.imageStyleId,
    moodStyleId: opts.moodStyleId,
  });
  const url =
    boot.actions.find((a) => a.plane === "background")?.imageUrl ||
    boot.actions[0]?.imageUrl;
  if (!url) {
    throw new Error(boot.message || "배경 생성에 실패했습니다.");
  }
  return url.trim();
}

/**
 * Initial lookbook base scene via InstantID FaceID (mandatory face ref).
 * Then split into scenic plate + transparent subject cutout.
 */
export async function generateLookbookBaseSceneDualLayer(opts: {
  prompt: string;
  identityUrl: string;
  aspectRatio: string;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
}): Promise<{ scenicUrl: string; cutoutUrl: string; plateUrl: string }> {
  const faceUrl = resolveMandatoryFaceUrl(opts.identityUrl);
  const plateUrl = await requestLookbookFaceId({
    faceImageUrl: faceUrl,
    prompt: opts.prompt,
    mode: "base_scene",
  });

  const [scenicUrl, cutoutUrl] = await Promise.all([
    cleanScenicBackgroundFromPlate({
      plateUrl,
      aspectRatio: opts.aspectRatio,
      imageStyleId: opts.imageStyleId,
      moodStyleId: opts.moodStyleId,
    }),
    cutoutLookbookSubject(plateUrl),
  ]);

  return { scenicUrl, cutoutUrl, plateUrl };
}

/**
 * Identity → full-body subject on studio backdrop via InstantID, then rembg.
 */
export async function generateLookbookSubjectCutout(opts: {
  prompt: string;
  identityUrl: string;
  aspectRatio: string;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
}): Promise<string> {
  const faceUrl = resolveMandatoryFaceUrl(opts.identityUrl);
  const plateUrl = await requestLookbookFaceId({
    faceImageUrl: faceUrl,
    prompt: opts.prompt,
    mode: "subject_studio",
  });
  return cutoutLookbookSubject(plateUrl);
}
