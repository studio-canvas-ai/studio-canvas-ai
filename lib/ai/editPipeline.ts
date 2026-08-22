/**
 * Edit pipeline — atomic per-request Fal jobs.
 *
 * Isolation rules:
 * - Each runEditPipeline call owns a fresh ParsedCommand (new requestId).
 * - Fal receives ONLY parsed.englishPrompt for this request (never prior prompts).
 * - Form copy never burns into Flux pixels (layerPolicy).
 * - Edit / inpaint use identity-lock guidance (+ masked inpaint when mask given).
 * - New random seed every background generation.
 */

import {
  mapAspectToFalImageSize,
  runFalFluxKontextInpaint,
  runFalFluxKontextPro,
  runFalFluxTextToImage,
  mapAspectRatioToFal,
} from "@/lib/ai/fal";
import { ImageProcessor } from "@/lib/ai/imageProcessor";
import { CommandRouter } from "@/lib/ai/intentRouter";
import {
  isFluxSafeEnglishPrompt,
  ensureEnglishFluxPrompt,
  newRequestId,
} from "@/lib/ai/commandParser";
import {
  jobsForIntent,
  jobRequiresSubject,
} from "@/lib/ai/editJobs";
import type { AiEditIntent } from "@/lib/ai/editIntents";
import { intentToKind } from "@/lib/ai/editIntents";
import type { ParsedCommand } from "@/lib/ai/commandParser";
import { applyVisualOnlyPolicy } from "@/lib/ai/layerPolicy";
import {
  applyIdentityLockPrompt,
  resolveIdentityLock,
} from "@/lib/ai/identityLock";
import type { StudioCoreMode } from "@/lib/ai/studioMode";
import type { VisualStyleSelection } from "@/lib/ai/visualStylePresets";
import { normalizeVisualStyleSelection } from "@/lib/ai/visualStylePresets";

export type CanvasPlane = "subject" | "background";

export type EditAction = {
  plane: CanvasPlane;
  imageUrl: string;
};

export type EditPipelineInput = {
  command: string;
  subjectUrl?: string | null;
  backgroundUrl?: string | null;
  aspectRatio?: string;
  /** Optional client correlation id (logged only). */
  clientRequestId?: string;
  /** Dual-mode profile (utility | agent). */
  mode?: StudioCoreMode | string | null;
  /** White = edit region for masked identity inpaint. */
  maskUrl?: string | null;
  identityRefUrl?: string | null;
  strength?: number;
  /** When false, skip identity-lock (rare). Default true. */
  identityLock?: boolean;
  /** Visual style / mood selection → Flux modifiers. */
  styleSelection?: VisualStyleSelection | null;
  /** Override router-classified intent (e.g. forced inpaint). */
  forceIntent?: AiEditIntent;
  /**
   * Skip Gemini CommandRouter rewrite — use this English string as the Fal prompt.
   * Required for lookbook base scene so prior outfit/location cannot bleed in.
   */
  englishPromptOverride?: string | null;
  /** Force Fal enhance_prompt off (lookbook). */
  disableEnhancePrompt?: boolean;
};

export type EditPipelineResult = {
  ok: true;
  parsed: ParsedCommand;
  actions: EditAction[];
  message: string;
  falPrompt: string;
  requestId: string;
};

export type EditPipelineError = {
  ok: false;
  parsed: ParsedCommand;
  error: string;
  message: string;
  requestId: string;
};

function isHttps(url: unknown): url is string {
  return typeof url === "string" && /^https:\/\//i.test(url.trim());
}

function freshSeed(): number {
  return (Math.floor(Math.random() * 2_147_483_646) + 1) >>> 0 || 1;
}

/** Wrap english prompt once — visual only, no typography burn-in. */
function fluxBackgroundPrompt(englishPrompt: string): string {
  const core = applyVisualOnlyPolicy(englishPrompt);
  if (/no people/i.test(core) && /background/i.test(core)) return core;
  return `${core}. Photorealistic empty photographic background, no people, no faces. High detail.`;
}

function fluxEditPrompt(englishPrompt: string, lockIdentity: boolean): string {
  const visual = applyVisualOnlyPolicy(englishPrompt);
  if (!lockIdentity) return visual;
  return applyIdentityLockPrompt(visual);
}

async function runGenerateBg(
  englishPrompt: string,
  aspectRatio: string | undefined,
  requestId: string
): Promise<{ url: string; falPrompt: string }> {
  const falPrompt = fluxBackgroundPrompt(englishPrompt);
  const seed = freshSeed();
  console.info("[editPipeline] generate_bg atomic", {
    requestId,
    seed,
    falPrompt: falPrompt.slice(0, 200),
  });
  const result = await runFalFluxTextToImage({
    prompt: falPrompt,
    image_size: mapAspectToFalImageSize(aspectRatio),
    num_images: 1,
    output_format: "jpeg",
    guidance_scale: 7.5,
    seed,
  });
  const url = result.images[0]?.url;
  if (!isHttps(url)) throw new Error("generate_bg_empty");
  return { url: url.trim(), falPrompt };
}

async function runRemoveBg(subjectUrl: string, requestId: string): Promise<string> {
  console.info("[editPipeline] remove_bg atomic", { requestId });
  const { cutoutUrl } = await ImageProcessor(subjectUrl);
  return cutoutUrl;
}

async function runEditImage(
  subjectUrl: string,
  englishPrompt: string,
  aspectRatio: string | undefined,
  requestId: string,
  opts: {
    lockIdentity: boolean;
    maskUrl?: string | null;
    identityRefUrl?: string | null;
    strength?: number;
  }
): Promise<{ url: string; falPrompt: string }> {
  const lock = resolveIdentityLock(englishPrompt);
  const falPrompt = fluxEditPrompt(englishPrompt, opts.lockIdentity);
  const guidance = opts.lockIdentity ? lock.guidanceScale : 3.5;
  const strength =
    typeof opts.strength === "number"
      ? Math.max(0.01, Math.min(1, opts.strength))
      : lock.strength;

  const mask = (opts.maskUrl || "").trim();
  const identityRef = (opts.identityRefUrl || subjectUrl).trim();

  // Masked path: precise region edit with reference identity.
  if (mask && opts.lockIdentity && lock.preferMaskedInpaint) {
    console.info("[editPipeline] inpaint identity-lock", {
      requestId,
      strength,
      guidance,
      falPrompt: falPrompt.slice(0, 200),
    });
    try {
      const result = await runFalFluxKontextInpaint({
        prompt: falPrompt,
        image_url: subjectUrl.trim(),
        mask_url: mask,
        reference_image_url: identityRef,
        strength,
        guidance_scale: guidance,
        num_images: 1,
        output_format: "png",
        num_inference_steps: 30,
      });
      const url = result.images[0]?.url;
      if (isHttps(url)) return { url: url.trim(), falPrompt };
    } catch (err) {
      console.warn("[editPipeline] masked inpaint failed — falling back to Kontext", {
        requestId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.info("[editPipeline] edit_image identity-lock", {
    requestId,
    guidance,
    falPrompt: falPrompt.slice(0, 200),
  });
  const result = await runFalFluxKontextPro({
    prompt: falPrompt,
    image_url: subjectUrl.trim(),
    num_images: 1,
    output_format: "png",
    aspect_ratio: mapAspectRatioToFal(aspectRatio || "1:1"),
    guidance_scale: guidance,
    // Never let Fal rewrite the prompt — causes outfit/location bleed.
    enhance_prompt: false,
  });
  const url = result.images[0]?.url;
  if (!isHttps(url)) throw new Error("edit_image_empty");
  return { url: url.trim(), falPrompt };
}

function messageFor(intent: AiEditIntent, label: string): string {
  switch (intent) {
    case "remove_bg":
      return "Background removed (transparent PNG).";
    case "generate_bg":
      return `Background ready: ${label}`;
    case "composite_bg":
      return `Composited on new background: ${label}`;
    case "edit_image":
    case "inpaint":
      return `Edit applied (identity lock): ${label}`;
    default:
      return "Could not understand the command. Try: remove background / Jeju beach background / change to a suit";
  }
}

/**
 * Execute one natural-language command in isolation (no cross-request prompt state).
 * Hard block: empty / contaminated englishPrompt never reaches Fal.
 */
export async function runEditPipeline(
  input: EditPipelineInput
): Promise<EditPipelineResult | EditPipelineError> {
  const styleSelection = normalizeVisualStyleSelection(
    input.styleSelection || null
  );
  const lockIdentity = input.identityLock !== false;
  const overrideRaw = (input.englishPromptOverride || "").trim();
  const overrideEnglish = overrideRaw
    ? ensureEnglishFluxPrompt(applyVisualOnlyPolicy(overrideRaw))
    : null;

  // Lookbook / forced path: skip Gemini rewrite so prior clothing cannot bleed in.
  let parsed: ParsedCommand;
  if (overrideEnglish && input.forceIntent && input.forceIntent !== "unknown") {
    const requestId = newRequestId();
    parsed = {
      intent: input.forceIntent,
      kind: intentToKind(input.forceIntent),
      englishPrompt: overrideEnglish,
      prompt: overrideEnglish.slice(0, 120),
      raw: (input.command || "").trim(),
      language: "en",
      confidence: "high",
      requestId,
    };
    console.info("[editPipeline] englishPromptOverride (router skipped)", {
      requestId,
      intent: parsed.intent,
      clientRequestId: input.clientRequestId || null,
      hasSubject: Boolean((input.subjectUrl || "").trim()),
      hasIdentityRef: Boolean((input.identityRefUrl || "").trim()),
      promptPreview: overrideEnglish.slice(0, 160),
    });
  } else {
    const parsedBase = await CommandRouter(input.command, { styleSelection });
    parsed =
      input.forceIntent && input.forceIntent !== "unknown"
        ? { ...parsedBase, intent: input.forceIntent }
        : parsedBase;
    if (overrideEnglish) {
      parsed = { ...parsed, englishPrompt: overrideEnglish, language: "en" };
    }
  }

  const requestId = parsed.requestId;
  const subject = (input.subjectUrl || "").trim();
  const aspect = input.aspectRatio;
  const english = parsed.englishPrompt.trim();

  console.info("[editPipeline] start", {
    requestId,
    mode: input.mode || "utility",
    clientRequestId: input.clientRequestId || null,
    intent: parsed.intent,
    forceIntent: input.forceIntent || null,
    language: parsed.language,
    routerError: parsed.routerError?.code || null,
    identityLock: lockIdentity,
    hasMask: Boolean(input.maskUrl),
    hasSubject: Boolean(subject),
    hasIdentityRef: Boolean((input.identityRefUrl || "").trim()),
    usedOverride: Boolean(overrideEnglish),
    styleSelection,
    command: parsed.raw.slice(0, 120),
  });

  // Hard require subject image for edit/inpaint — never silent T2I face invent.
  if (
    (parsed.intent === "edit_image" || parsed.intent === "inpaint") &&
    !subject
  ) {
    return {
      ok: false,
      parsed,
      error: "subject_required",
      message:
        "Face ID image missing. Select a trained face in 학습사진 저장소 first.",
      requestId,
    };
  }

  // Refuse Flux when router could not produce a safe English prompt.
  if (
    parsed.routerError &&
    !english &&
    (parsed.intent === "generate_bg" ||
      parsed.intent === "composite_bg" ||
      parsed.intent === "edit_image" ||
      parsed.intent === "inpaint" ||
      parsed.intent === "unknown")
  ) {
    console.error("[editPipeline] blocked_flux_contamination", {
      requestId,
      code: parsed.routerError.code,
      message: parsed.routerError.message,
    });
    return {
      ok: false,
      parsed,
      error: parsed.routerError.code,
      message: parsed.routerError.message,
      requestId,
    };
  }

  if (parsed.intent === "unknown") {
    return {
      ok: false,
      parsed,
      error: parsed.routerError?.code || "unknown_intent",
      message:
        parsed.routerError?.message || messageFor("unknown", parsed.prompt),
      requestId,
    };
  }

  // Scene jobs must have Flux-safe English (never Hangul/CJK → Flux).
  const needsEnglishFlux =
    parsed.intent === "generate_bg" ||
    parsed.intent === "composite_bg" ||
    parsed.intent === "edit_image" ||
    parsed.intent === "inpaint";

  if (needsEnglishFlux && !english) {
    return {
      ok: false,
      parsed,
      error: "gemini_empty_english_prompt",
      message:
        "No safe English Flux prompt available. Check GEMINI_API_KEY / model and retry.",
      requestId,
    };
  }

  if (needsEnglishFlux && !isFluxSafeEnglishPrompt(english)) {
    console.error("[editPipeline] blocked_unsafe_english", {
      requestId,
      preview: english.slice(0, 120),
      language: parsed.language,
    });
    return {
      ok: false,
      parsed,
      error: "gemini_english_prompt_contaminated",
      message:
        "Flux blocked: prompt was not safe English (Hangul/CJK or too weak). Gemini routing required.",
      requestId,
    };
  }

  try {
    const actions: EditAction[] = [];
    let falPrompt = english;

    const jobList = jobsForIntent(parsed.intent, {
      subjectUrl: subject,
      englishPrompt: english,
      aspectRatio: aspect,
      maskUrl: input.maskUrl,
    });

    if (jobList.length === 0) {
      return {
        ok: false,
        parsed,
        error: "unknown_intent",
        message: messageFor("unknown", parsed.prompt),
        requestId,
      };
    }

    if (jobRequiresSubject(jobList) && !subject) {
      return {
        ok: false,
        parsed,
        error: "subject_required",
        message: "Upload a subject photo first.",
        requestId,
      };
    }

    let currentSubject = subject;

    for (const job of jobList) {
      switch (job.kind) {
        case "rembg": {
          const src = (job.inputImage || currentSubject).trim();
          const cutout = await runRemoveBg(src, requestId);
          currentSubject = cutout;
          actions.push({ plane: job.plane, imageUrl: cutout });
          falPrompt = "rembg";
          break;
        }
        case "generate_bg": {
          const bg = await runGenerateBg(
            job.prompt || english,
            job.aspectRatio || aspect,
            requestId
          );
          falPrompt = bg.falPrompt;
          actions.push({ plane: job.plane, imageUrl: bg.url });
          break;
        }
        case "edit_image":
        case "inpaint": {
          const edited = await runEditImage(
            currentSubject,
            job.prompt || english,
            job.aspectRatio || aspect,
            requestId,
            {
              lockIdentity,
              maskUrl: job.maskUrl || input.maskUrl,
              identityRefUrl: input.identityRefUrl,
              strength: input.strength,
            }
          );
          falPrompt = edited.falPrompt;
          actions.push({ plane: job.plane, imageUrl: edited.url });
          currentSubject = edited.url;
          break;
        }
        default:
          break;
      }
    }

    const warn =
      parsed.routerError &&
      parsed.routerError.code !== "empty_command"
        ? ` ⚠ ${parsed.routerError.code}`
        : "";

    return {
      ok: true,
      parsed,
      actions,
      message:
        messageFor(parsed.intent, parsed.prompt || english.slice(0, 80)) + warn,
      falPrompt,
      requestId,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI edit pipeline failed";
    console.error("[editPipeline] failed", { requestId, message });
    return {
      ok: false,
      parsed,
      error: "pipeline_failed",
      message,
      requestId,
    };
  }
}
