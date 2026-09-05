/**
 * Photo lookbook — full-body context inpaint with upper-body mask + Face ID lock.
 * Always requires identitySrc; uses englishPromptOverride (no Gemini bleed).
 */

import { requestAiCommand, AiStudioError } from "@/lib/aiCommand";
import { prepareGenerateImageUrls } from "@/lib/prepareGenerateImages";
import {
  LOOKBOOK_PORTRAIT_FRAMING,
  LOOKBOOK_SCALE_LOCK,
} from "@/lib/photoLookbookFraming";
import {
  LOOKBOOK_PHOTOREAL_QUALITY,
  buildAtomicLookbookPrompt,
} from "@/lib/photoLookbookPrompt";
import {
  buildPhotoInpaintScene,
  type PhotoInpaintSceneInput,
} from "@/lib/photoInpaintScene";
import { resolveActiveTrainedFace } from "@/lib/photoVaultStorage";

export type PhotoInpaintGenerateInput = PhotoInpaintSceneInput & {
  prompt: string;
  aspectRatio?: string;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
};

export type PhotoInpaintGenerateResult = {
  imageUrl: string;
  message: string;
  requestId?: string;
};

/** Always appended so lower-body wardrobe/style stays coherent with upper edits. */
const LOWER_BODY_STYLE_LOCK =
  "Keep the style and clothing of the lower body consistent";

export async function runPhotoInpaintGenerate(
  input: PhotoInpaintGenerateInput
): Promise<PhotoInpaintGenerateResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new AiStudioError("변형 명령을 입력해 주세요.", {
      status: 400,
      code: "prompt_required",
    });
  }

  const scene = await buildPhotoInpaintScene({ ...input, prompt });
  const activeFace = resolveActiveTrainedFace()?.src?.trim();
  const identitySrc = activeFace || scene.identitySrc;
  if (!identitySrc?.trim()) {
    throw new AiStudioError(
      "Face ID가 없습니다. 학습사진 저장소에서 얼굴을 선택·학습해 주세요.",
      { status: 400, code: "face_required" }
    );
  }

  const [sceneUrl, maskUrl, identityUrl] = await prepareGenerateImageUrls(
    [scene.sceneDataUrl, scene.maskDataUrl, identitySrc],
    { maxImages: 3 }
  );

  const dualLayer = scene.iterativePlate && (input.photoLayers?.length ?? 0) > 0;
  const editKind = scene.editKind;
  const strength =
    editKind === "pose" ? 0.84 : editKind === "wardrobe" ? 0.76 : 0.8;

  // Atomic prompt — current input only + photoreal lock (no prior clothing bleed).
  const built = buildAtomicLookbookPrompt({
    userPrompt: prompt,
    mode: "subject_edit",
  });
  const kindHint =
    editKind === "wardrobe"
      ? "Change upper-body clothing / top as requested. Match formality, fabric family, and color harmony with the visible lower body."
      : editKind === "pose"
        ? "Change upper-body pose / hands / arms as requested. Keep the lower-body stance and garment silhouette coherent."
        : "Edit only the masked upper region as requested while staying coherent with the visible lower body.";

  const falPrompt = [
    built.prompt,
    "FULL-BODY CONTEXT INPAINT.",
    LOOKBOOK_PORTRAIT_FRAMING + ".",
    LOOKBOOK_SCALE_LOCK + ".",
    "WHITE / soft-gray MASK = editable upper body + waist transition zone only.",
    "BLACK MASK = frozen (scenic background AND lower body).",
    kindHint,
    LOWER_BODY_STYLE_LOCK + ".",
    LOOKBOOK_PHOTOREAL_QUALITY + ".",
    dualLayer ? "Independent subject cutout sits on a locked scenic plate." : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const result = await requestAiCommand({
    command: `LOOKBOOK_INPAINT ${Date.now()} ${prompt.slice(0, 40)}`,
    englishPromptOverride: falPrompt,
    mode: "utility",
    subjectUrl: sceneUrl,
    maskUrl,
    identityRefUrl: identityUrl,
    strength,
    aspectRatio: input.aspectRatio || "9:16",
    imageStyleId: input.imageStyleId,
    moodStyleId: input.moodStyleId,
    forceIntent: "inpaint",
    identityLock: true,
  });

  const imageUrl =
    result.actions.find((a) => a.plane === "subject")?.imageUrl ||
    result.actions[0]?.imageUrl;

  if (!imageUrl) {
    throw new AiStudioError(result.message || "인물 변형에 실패했습니다.", {
      status: 502,
      code: "inpaint_empty",
    });
  }

  return {
    imageUrl,
    message: result.message,
    requestId: result.requestId,
  };
}
