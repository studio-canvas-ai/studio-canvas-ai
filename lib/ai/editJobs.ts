/**
 * Typed edit job descriptors — intent → Fal ops → canvas plane mapping.
 */

import type { AiEditIntent } from "@/lib/ai/editIntents";

export type CanvasPlane = "subject" | "background";

export type EditJobKind =
  | "rembg"
  | "generate_bg"
  | "edit_image"
  | "inpaint";

export type EditJobDescriptor = {
  kind: EditJobKind;
  plane: CanvasPlane;
  inputImage?: string;
  prompt?: string;
  maskUrl?: string;
  aspectRatio?: string;
};

export type EditJobResult = {
  imageUrl: string;
  falPrompt: string;
};

export type EditJobContext = {
  subjectUrl?: string;
  englishPrompt: string;
  aspectRatio?: string;
  maskUrl?: string | null;
};

/**
 * Expand a resolved intent into ordered Fal jobs (composite = rembg then T2I).
 */
export function jobsForIntent(
  intent: AiEditIntent,
  ctx: EditJobContext
): EditJobDescriptor[] {
  const subject = (ctx.subjectUrl || "").trim();
  const prompt = ctx.englishPrompt.trim();
  const aspect = ctx.aspectRatio;
  const mask = (ctx.maskUrl || "").trim() || undefined;

  switch (intent) {
    case "remove_bg":
      return [{ kind: "rembg", plane: "subject", inputImage: subject }];
    case "generate_bg":
      return [
        {
          kind: "generate_bg",
          plane: "background",
          prompt,
          aspectRatio: aspect,
        },
      ];
    case "composite_bg":
      return [
        { kind: "rembg", plane: "subject", inputImage: subject },
        {
          kind: "generate_bg",
          plane: "background",
          prompt,
          aspectRatio: aspect,
        },
      ];
    case "edit_image":
      return [
        {
          kind: "edit_image",
          plane: "subject",
          inputImage: subject,
          prompt,
          aspectRatio: aspect,
        },
      ];
    case "inpaint":
      return [
        {
          kind: "inpaint",
          plane: "subject",
          inputImage: subject,
          prompt,
          aspectRatio: aspect,
          maskUrl: mask,
        },
      ];
    default:
      return [];
  }
}

export function jobRequiresSubject(jobs: EditJobDescriptor[]): boolean {
  return jobs.some((j) => j.kind === "rembg" || j.kind === "edit_image" || j.kind === "inpaint");
}
