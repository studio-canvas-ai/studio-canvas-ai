/**
 * Atomic lookbook prompt builder — no session memory, no prior-generation bleed.
 * Every call builds a fresh English prompt from the current user text only.
 */

import {
  LOOKBOOK_PORTRAIT_FRAMING,
  LOOKBOOK_SCALE_LOCK,
} from "@/lib/photoLookbookFraming";
import {
  LOOKBOOK_IDENTITY_PRIORITY,
  enhanceLookbookScenePrompt,
} from "@/lib/photoLookbookSceneEnhance";

/** Always applied for photoreal lookbook output (never anime / illustration). */
export const LOOKBOOK_PHOTOREAL_QUALITY = [
  "photorealistic",
  "professional studio lighting",
  "raw photo",
  "DSLR",
  "85mm lens",
  "natural skin texture",
  "high detail",
  "sharp focus",
].join(", ");

export const LOOKBOOK_NEGATIVE_PROMPT = [
  "anime",
  "cartoon",
  "illustration",
  "painting",
  "3d render",
  "cgi",
  "different person",
  "face morph",
  "identity drift",
  "deformed face",
  "blurry",
  "low quality",
  "watermark",
  "text",
  "logo",
].join(", ");

export type LookbookPromptMode = "base_scene" | "subject_studio" | "subject_edit";

/**
 * Build a brand-new Fal InstantID / Kontext prompt from this request only.
 * Never concatenates previous clothing, pose, or location strings.
 */
export function buildAtomicLookbookPrompt(opts: {
  userPrompt: string;
  mode: LookbookPromptMode;
  requestId?: string;
}): { prompt: string; negativePrompt: string; original: string; placeMatched: boolean } {
  const original = (opts.userPrompt || "").trim();
  // Stateless enhance — derived only from `original`.
  const { enhanced, placeMatched } = enhanceLookbookScenePrompt(original);

  const sceneBlock = enhanced || original;
  const rid = opts.requestId ? `req=${opts.requestId}` : `t=${Date.now()}`;

  const parts: string[] = [
    // Correlation only — not prior content.
    `[atomic ${rid}]`,
    LOOKBOOK_IDENTITY_PRIORITY,
    LOOKBOOK_PHOTOREAL_QUALITY + ".",
  ];

  if (opts.mode === "base_scene") {
    parts.push(
      "Complete photoreal lookbook photograph of this exact person from the face reference.",
      LOOKBOOK_PORTRAIT_FRAMING + ".",
      LOOKBOOK_SCALE_LOCK + ".",
      "Ignore any previous generation, previous outfit, and previous location.",
      "Place the person naturally in the scene with correct pose, wardrobe for this scene only, lighting, and ground contact.",
      "Do not output an empty background. Do not paste a floating cropped head.",
      sceneBlock
    );
  } else if (opts.mode === "subject_studio") {
    parts.push(
      "Photoreal lookbook portrait of this exact person on a plain light-gray seamless studio backdrop.",
      LOOKBOOK_PORTRAIT_FRAMING + ".",
      LOOKBOOK_SCALE_LOCK + ".",
      "Ignore any previous outfit or pose. Use only this request:",
      sceneBlock
    );
  } else {
    parts.push(
      "Edit only as requested while preserving facial identity from the face reference.",
      LOOKBOOK_PORTRAIT_FRAMING + ".",
      "Ignore any previous clothing or pose not mentioned below.",
      sceneBlock,
      LOOKBOOK_PHOTOREAL_QUALITY
    );
  }

  const prompt = parts.join(" ").replace(/\s+/g, " ").trim();
  return {
    prompt,
    negativePrompt: LOOKBOOK_NEGATIVE_PROMPT,
    original,
    placeMatched,
  };
}
