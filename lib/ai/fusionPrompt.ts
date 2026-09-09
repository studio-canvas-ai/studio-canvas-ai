/**
 * Face + style + background fusion prompts for portrait re-rendering.
 * Used by PersonaCreator (client) and inference (server) — keep in sync.
 */
import { BACKGROUND_TAG_IDS } from "@/lib/data";
import { buildMappedStylePrompt } from "@/lib/ai/stylePrompts";

export const FUSION_RERENDER_DIRECTIVE =
  "Fully re-render a single unified photorealistic editorial portrait — never paste, overlay, cut out, or composite the reference face onto a background. The subject must be naturally integrated into the scene with matching perspective, depth, and contact shadows.";

export const LIGHTING_CONSISTENCY_DIRECTIVE =
  "Match skin tone, shadows, specular highlights, and eyewear reflections to the scene lighting direction and color temperature. Seamless global illumination — no visible compositing edges, halos, or mismatched white balance.";

/** Face-scene harmonization — subject lives inside the environment, not pasted on top. */
export const FACE_SCENE_HARMONIZATION =
  "Integrate the subject into the environment as if photographed on location: match ambient light direction, soft contact shadows under chin and hair, atmospheric perspective, environmental color bounce on skin, and subtle rim light from the scene. Natural volumetric presence — never a cutout, sticker, or passport-style composite.";

export const CAMERA_COHERENCE_DIRECTIVE =
  "Unified camera: consistent focal length, scene-appropriate angle, realistic depth of field and edge lighting that matches background depth, mood, and time of day.";

/** English scene descriptions for step-3 background tag ids. */
export const BACKGROUND_TAG_SCENE_EN: Record<
  (typeof BACKGROUND_TAG_IDS)[number],
  string
> = {
  studio:
    "professional photography studio with soft neutral seamless backdrop and controlled softbox lighting",
  city: "modern city skyline at golden hour with urban atmosphere and ambient street glow",
  nature:
    "scenic natural outdoor landscape with greenery, soft daylight, and atmospheric depth",
  luxury:
    "luxury hotel or elegant interior with warm ambient lighting and refined décor",
  neon: "neon-lit city street at night with vibrant cyan and magenta glow on wet pavement",
  hanok:
    "traditional Korean hanok courtyard with wooden architecture and serene natural daylight",
};

export type BackgroundPromptInput = {
  mode: "auto" | "tags" | "custom";
  tags?: string[];
  custom?: string;
  /** Override keyword (detail-view AI background bar). */
  keywordOverride?: string;
};

/** Build the background scene phrase from wizard step 3 (or detail keyword). */
export function buildBackgroundScenePrompt(input: BackgroundPromptInput): string {
  const override = (input.keywordOverride || "").trim();
  if (override) return override;

  if (input.mode === "custom") {
    return (input.custom || "").trim();
  }

  if (input.mode === "tags") {
    const tags = (input.tags || []).filter(Boolean);
    if (!tags.length) return "";
    const scenes = tags
      .map((tag) => {
        const key = tag as (typeof BACKGROUND_TAG_IDS)[number];
        return BACKGROUND_TAG_SCENE_EN[key] || tag;
      })
      .filter(Boolean);
    return scenes.join("; ");
  }

  // auto — style-driven default; inference layer adds style-specific bg if empty.
  return "";
}

export type PortraitFusionPromptInput = {
  styleIds?: string[];
  userPrompt?: string;
  backgroundScene?: string;
  poseHint?: string;
  /** Background fusion re-render — add face-scene harmonization directives. */
  harmonize?: boolean;
};

/**
 * Final Kontext / GPU prompt: style pack + background + fusion directives.
 * `userPrompt` is optional extra direction from the detail textarea.
 */
export function buildPortraitFusionPrompt(
  input: PortraitFusionPromptInput
): string {
  const user = (input.userPrompt || "").trim();
  const bg = (input.backgroundScene || "").trim();

  const styleCore = buildMappedStylePrompt({
    styleIds: input.styleIds,
    userPrompt: "",
  });

  const parts = [
    FUSION_RERENDER_DIRECTIVE,
    styleCore,
    bg
      ? `Scene / background (integrate the subject naturally): ${bg}.`
      : "Choose a background that matches the selected editorial style and pose.",
    input.poseHint?.trim()
      ? `Pose and expression: ${input.poseHint.trim()}.`
      : "",
    LIGHTING_CONSISTENCY_DIRECTIVE,
    input.harmonize ? FACE_SCENE_HARMONIZATION : "",
    input.harmonize ? CAMERA_COHERENCE_DIRECTIVE : "",
    user ? `Additional user direction: ${user}` : "",
  ].filter(Boolean);

  return parts.join(" ");
}

/** Client-side: merge step-3 background + optional extra prompt for API payload. */
export function resolvePortraitGenerationPrompt(opts: {
  styleIds?: string[];
  background: BackgroundPromptInput;
  additionalPrompt?: string;
  poseHint?: string;
}): { prompt: string; backgroundScene: string } {
  const backgroundScene = buildBackgroundScenePrompt(opts.background);
  const prompt = buildPortraitFusionPrompt({
    styleIds: opts.styleIds,
    userPrompt: opts.additionalPrompt,
    backgroundScene,
    poseHint: opts.poseHint,
  });
  return { prompt, backgroundScene };
}
