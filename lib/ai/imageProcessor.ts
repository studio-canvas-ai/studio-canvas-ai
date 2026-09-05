/**
 * ImageProcessor — upload pipeline that always runs Fal rembg
 * so the subject layer is a transparent PNG.
 */

import { runFalRembg, validateFalResultUrl } from "@/lib/ai/fal";

export type ProcessSubjectResult = {
  /** HTTPS URL of the cutout PNG (alpha). */
  cutoutUrl: string;
  requestId?: string;
};

/**
 * Server-side processor: input photo (https or data URI) → rembg cutout.
 */
export async function ImageProcessor(
  imageUrl: string,
  opts?: { portrait?: boolean }
): Promise<ProcessSubjectResult> {
  const src = imageUrl.trim();
  if (!src) throw new Error("image_required");

  const result = await runFalRembg(src, {
    portrait: opts?.portrait !== false,
  });
  const cutoutUrl = validateFalResultUrl(result.images[0]?.url, "rembg");
  return {
    cutoutUrl,
    requestId: result.requestId,
  };
}

export const processSubjectImage = ImageProcessor;
