/**
 * Shared Studio Canvas AI core engine.
 * Both Template Studio (utility) and Print Agent (agent) call this entrypoint.
 */

import {
  runEditPipeline,
  type EditPipelineError,
  type EditPipelineInput,
  type EditPipelineResult,
} from "@/lib/ai/editPipeline";
import { assertNoBurnInIntent } from "@/lib/ai/layerPolicy";
import type { AiEditIntent } from "@/lib/ai/editIntents";
import {
  resolveStudioMode,
  studioModeProfile,
  type StudioCoreMode,
  type StudioModeProfile,
} from "@/lib/ai/studioMode";

export type CoreEngineInput = EditPipelineInput & {
  mode?: StudioCoreMode | string | null;
  /** Print form copy — logged as overlay-only; never forwarded to Fal. */
  formFields?: Record<string, string> | null;
  /** Optional mask for identity-preserving inpaint (https or data URI). */
  maskUrl?: string | null;
  /** Optional identity reference (defaults to subjectUrl). */
  identityRefUrl?: string | null;
  /** Denoising / inpaint strength override (0.01–1). */
  strength?: number;
  /** Override CommandRouter intent (photo lookbook inpaint). */
  forceIntent?: AiEditIntent;
  /** Skip Gemini rewrite — use this English as Fal prompt (lookbook). */
  englishPromptOverride?: string | null;
  /** Force Fal enhance_prompt off. */
  disableEnhancePrompt?: boolean;
};

export type CoreEngineResult = (EditPipelineResult | EditPipelineError) & {
  mode: StudioCoreMode;
  profile: StudioModeProfile;
};

/**
 * Run the shared NL → plane pipeline under a dual-mode profile.
 */
export async function runStudioCoreEngine(
  input: CoreEngineInput
): Promise<CoreEngineResult> {
  const mode = resolveStudioMode(input.mode);
  const profile = studioModeProfile(mode);

  assertNoBurnInIntent(input.formFields);

  console.info("[coreEngine] start", {
    mode,
    profile: profile.label,
    hasFormFields: Boolean(input.formFields),
    hasMask: Boolean(input.maskUrl),
    styleSelection: input.styleSelection || null,
    command: (input.command || "").slice(0, 80),
  });

  const result = await runEditPipeline({
    command: input.command,
    subjectUrl: input.subjectUrl,
    backgroundUrl: input.backgroundUrl,
    aspectRatio: input.aspectRatio,
    clientRequestId: input.clientRequestId,
    mode: mode,
    maskUrl: input.maskUrl,
    identityRefUrl: input.identityRefUrl,
    strength: input.strength,
    identityLock:
      typeof input.identityLock === "boolean"
        ? input.identityLock
        : profile.identityLock,
    styleSelection: input.styleSelection,
    forceIntent: input.forceIntent,
    englishPromptOverride: input.englishPromptOverride,
    disableEnhancePrompt: input.disableEnhancePrompt,
  });

  return { ...result, mode, profile };
}

export {
  resolveStudioMode,
  studioModeProfile,
  type StudioCoreMode,
  type StudioModeProfile,
};
