/**
 * Build canvas scene + subject mask for photo lookbook inpainting.
 * Full-body context in image_url; upper-body (+ waist feather) mask only.
 */

import {
  enforceLookbookSubjectMinScale,
  photoToBox,
  type PrintPhotoLayer,
} from "@/lib/printWizardPhotoLayers";
import { pageBackgroundUrl } from "@/lib/printWizardBg";
import { resolveActiveTrainedFace, listUploadVault } from "@/lib/photoVaultStorage";
import { toRawImageUrl } from "@/lib/aiCommand";

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = src.trim();
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) {
  const ir = img.naturalWidth / Math.max(1, img.naturalHeight);
  const cr = w / Math.max(1, h);
  let dw = w;
  let dh = h;
  let dx = 0;
  let dy = 0;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
    dx = (w - dw) / 2;
  } else {
    dw = w;
    dh = w / ir;
    dy = (h - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number }
) {
  const ir = img.naturalWidth / Math.max(1, img.naturalHeight);
  const br = box.width / Math.max(1, box.height);
  let dw = box.width;
  let dh = box.height;
  let dx = box.x;
  let dy = box.y;
  if (ir > br) {
    dw = box.width;
    dh = box.width / ir;
    dy = box.y + (box.height - dh) / 2;
  } else {
    dh = box.height;
    dw = box.height * ir;
    dx = box.x + (box.width - dw) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

export type LookbookEditKind = "wardrobe" | "pose" | "general";

/**
 * Classify edit so the mask stays upper-body focused while pose/hands get arm room.
 */
export function classifyLookbookEdit(prompt: string): LookbookEditKind {
  const p = prompt.trim();
  if (
    /(옷|의상|복장|양장|한복|정장|재킷|자켓|셔츠|원피스|수트|코트|티셔츠|니트|블라우스|wardrobe|outfit|clothes|clothing|dress|suit|jacket|shirt|hanbok|tuxedo)/i.test(
      p
    )
  ) {
    return "wardrobe";
  }
  if (
    /(손|두손|팔|포즈|자세|들고|들어|올려|벌린|앉아|서\s*있|걷|뛰|춤|pose|hand|arm|sit|stand|hold|raise|spread|wave|gesture)/i.test(
      p
    )
  ) {
    return "pose";
  }
  return "general";
}

type MaskBox = { x: number; y: number; width: number; height: number };

/**
 * Upper-body editable mask with soft waist transition (feather).
 * Lower body stays BLACK so it remains frozen visual context inside image_url.
 * Fal: white = edit, black = lock, gray = soft blend.
 */
function paintUpperBodyFeatheredMask(
  mctx: CanvasRenderingContext2D,
  box: MaskBox,
  stageW: number,
  stageH: number,
  kind: LookbookEditKind
) {
  // How far down the subject box is fully editable (solid white).
  const solidEnd =
    kind === "pose" ? 0.58 : kind === "wardrobe" ? 0.52 : 0.55;
  // Waist transition zone (soft gray → black). Below this: fully locked.
  const featherEnd =
    kind === "pose" ? 0.78 : kind === "wardrobe" ? 0.72 : 0.74;

  const padX = box.width * (kind === "pose" ? 0.22 : 0.12);
  const padTop = box.height * 0.06;
  const left = Math.max(0, box.x - padX);
  const right = Math.min(stageW, box.x + box.width + padX);
  const top = Math.max(0, box.y - padTop);
  const bottom = Math.min(stageH, box.y + box.height * featherEnd);
  const solidBottom = Math.min(stageH, box.y + box.height * solidEnd);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  const layer = document.createElement("canvas");
  layer.width = stageW;
  layer.height = stageH;
  const lctx = layer.getContext("2d");
  if (!lctx) return;

  // Vertical falloff: solid white (head→chest) → soft waist → black (hips/legs).
  const grad = lctx.createLinearGradient(0, top, 0, bottom);
  const solidT = Math.max(0.05, (solidBottom - top) / height);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(Math.min(0.92, solidT), "rgba(255,255,255,1)");
  grad.addColorStop(Math.min(0.98, solidT + (1 - solidT) * 0.45), "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");

  lctx.fillStyle = grad;
  // Capsule / rounded upper body so side edges are not hard rectangles.
  const rx = width / 2;
  const ry = height * 0.52;
  const cx = left + width / 2;
  const cy = top + height * 0.42;
  lctx.beginPath();
  lctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  lctx.fill();

  // Feather all edges (waist + silhouette) for seamless blend.
  const blurPx = Math.max(10, Math.round(Math.min(stageW, stageH) * 0.018));
  mctx.save();
  mctx.filter = `blur(${blurPx}px)`;
  mctx.drawImage(layer, 0, 0);
  mctx.restore();
}

/**
 * Legacy fused-plate fallback: upper-body centered mask (≥50% stage height).
 */
function paintSubjectCentricUpperMask(
  mctx: CanvasRenderingContext2D,
  stageW: number,
  stageH: number,
  kind: LookbookEditKind
) {
  const box: MaskBox = {
    x: stageW * 0.12,
    y: stageH * 0.06,
    width: stageW * 0.76,
    height: stageH * 0.88,
  };
  paintUpperBodyFeatheredMask(mctx, box, stageW, stageH, kind);
}

export type PhotoInpaintSceneInput = {
  backgroundUrls?: Array<string | null | undefined>;
  backgroundUrl?: string | null;
  photoLayers: PrintPhotoLayer[];
  pageIndex?: number;
  stageW?: number;
  stageH?: number;
  /** User prompt — drives upper-body mask extent (wardrobe vs pose). */
  prompt?: string;
};

export type PhotoInpaintScenePayload = {
  sceneDataUrl: string;
  maskDataUrl: string;
  identitySrc: string;
  stageW: number;
  stageH: number;
  /** True when scenic plate is present. */
  iterativePlate: boolean;
  editKind: LookbookEditKind;
};

/**
 * Pick identity face for lookbook / inpaint.
 * Priority: active trained vault → newest trained → non-generated canvas layer → upload vault.
 * Never use the AI-generated lookbook subject layer (causes face/outfit bleed).
 */
export function resolvePhotoIdentitySrc(
  photoLayers: PrintPhotoLayer[]
): string | null {
  const active = resolveActiveTrainedFace();
  if (active?.src?.trim()) return active.src.trim();

  for (const layer of photoLayers) {
    const src = layer?.src?.trim();
    if (!src) continue;
    if (layer.id === "lookbook-subject") continue;
    return src;
  }

  const upload = listUploadVault()[0]?.src?.trim();
  return upload || null;
}

/**
 * Composite FULL scenic + FULL subject (never crop torso-only into image_url).
 * Mask = upper body only, with soft waist transition so lower body stays context.
 */
export async function buildPhotoInpaintScene(
  input: PhotoInpaintSceneInput
): Promise<PhotoInpaintScenePayload> {
  const stageW = Math.max(512, Math.round(input.stageW ?? 1080));
  const stageH = Math.max(512, Math.round(input.stageH ?? 1920));
  const pageIndex = input.pageIndex ?? 0;
  const editKind = classifyLookbookEdit(input.prompt || "");
  const bgUrlRaw = pageBackgroundUrl(
    input.backgroundUrls,
    input.backgroundUrl,
    pageIndex
  );
  const bgUrl = bgUrlRaw ? bgUrlRaw.trim() : null;
  const layers = (input.photoLayers ?? []).filter((l) =>
    Boolean(l?.src?.trim())
  );
  const identitySrc = resolvePhotoIdentitySrc(layers);
  if (!identitySrc) {
    throw new Error("photo_identity_missing");
  }

  const iterativePlate = Boolean(bgUrl);
  const paintLayers = layers;

  const scene = document.createElement("canvas");
  scene.width = stageW;
  scene.height = stageH;
  const sctx = scene.getContext("2d");
  if (!sctx) throw new Error("canvas_unavailable");

  sctx.fillStyle = "#0b0f19";
  sctx.fillRect(0, 0, stageW, stageH);

  if (bgUrl) {
    try {
      const bg = await loadHtmlImage(bgUrl);
      drawCover(sctx, bg, stageW, stageH);
    } catch {
      try {
        const raw = toRawImageUrl(bgUrl);
        if (raw && raw !== bgUrl) {
          const bg = await loadHtmlImage(raw);
          drawCover(sctx, bg, stageW, stageH);
        }
      } catch {
        /* keep solid fill */
      }
    }
  }

  const mask = document.createElement("canvas");
  mask.width = stageW;
  mask.height = stageH;
  const mctx = mask.getContext("2d");
  if (!mctx) throw new Error("canvas_unavailable");
  mctx.fillStyle = "#000000";
  mctx.fillRect(0, 0, stageW, stageH);

  if (paintLayers.length > 0) {
    for (const layer of paintLayers) {
      // Ensure inpaint composite never uses a miniature subject bbox.
      const scaled = enforceLookbookSubjectMinScale(layer, stageW, stageH);
      const box = photoToBox(scaled, stageW, stageH);
      // Full subject cutout into scene — lower body visible as context.
      try {
        const img = await loadHtmlImage(scaled.src);
        drawContain(sctx, img, box);
      } catch {
        /* mask still marks edit region */
      }
      paintUpperBodyFeatheredMask(mctx, box, stageW, stageH, editKind);
    }
  } else if (iterativePlate) {
    paintSubjectCentricUpperMask(mctx, stageW, stageH, editKind);
  } else {
    const mw = stageW * 0.48;
    const mh = stageH * 0.72;
    const mx = (stageW - mw) / 2;
    const my = (stageH - mh) / 2;
    const box: MaskBox = { x: mx, y: my, width: mw, height: mh };
    try {
      const face = await loadHtmlImage(identitySrc);
      drawContain(sctx, face, box);
    } catch {
      /* mask alone */
    }
    paintUpperBodyFeatheredMask(mctx, box, stageW, stageH, editKind);
  }

  if (!bgUrl && paintLayers.length === 0) {
    throw new Error("photo_scene_missing");
  }

  return {
    sceneDataUrl: scene.toDataURL("image/jpeg", 0.92),
    maskDataUrl: mask.toDataURL("image/png"),
    identitySrc,
    stageW,
    stageH,
    iterativePlate,
    editKind,
  };
}
