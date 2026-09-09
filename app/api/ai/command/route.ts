import { NextResponse } from "next/server";
import { hasFalCredentials, logFalApiError } from "@/lib/ai/fal";
import { runStudioCoreEngine } from "@/lib/ai/coreEngine";
import { sanitizeCommandInput } from "@/lib/ai/commandParser";
import { coerceIntent, type AiEditIntent } from "@/lib/ai/editIntents";
import { normalizeVisualStyleSelection } from "@/lib/ai/visualStylePresets";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { resolveAppUser } from "@/lib/resolveAppUser";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  command?: string;
  subjectUrl?: string;
  imageUrl?: string;
  backgroundUrl?: string;
  aspectRatio?: string;
  /** utility | agent — dual-mode core engine */
  mode?: string;
  maskUrl?: string;
  identityRefUrl?: string;
  strength?: number;
  formFields?: Record<string, string>;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
  styleIds?: string[];
  /** Client-generated id — must be unique per click; never reuse prior prompts. */
  clientRequestId?: string;
  /** Override router intent (e.g. photo lookbook inpaint). */
  forceIntent?: string;
  /** Override identity lock (false = allow full scene rewrite / person removal). */
  identityLock?: boolean;
  /** Skip Gemini rewrite — Fal uses this English only (lookbook). */
  englishPromptOverride?: string;
};

function unwrapMediaProxy(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/api/media/fetch?src=")) {
    try {
      return decodeURIComponent(url.split("src=")[1] || "") || url;
    } catch {
      return url;
    }
  }
  return url;
}

/**
 * POST /api/ai/command
 * Shared core engine: Template Studio (utility) + Print Agent (agent).
 */
export async function POST(req: Request) {
  try {
    if (!hasFalCredentials()) {
      return NextResponse.json(
        {
          ok: false,
          error: "fal_unconfigured",
          message: "FAL_KEY is not configured.",
        },
        { status: 503 }
      );
    }

    const resolved = await resolveAppUser(req);
    const userId = resolved.ok ? resolved.user.id : null;
    const rl = checkGenerateRateLimit(req, userId);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", resetAt: rl.resetAt },
        { status: 429 }
      );
    }

    const raw = (await req.json().catch(() => null)) as Body | null;
    const command = sanitizeCommandInput(
      typeof raw?.command === "string" ? raw.command : ""
    );
    if (!command) {
      return NextResponse.json(
        { ok: false, error: "command_required", message: "command is required" },
        { status: 400 }
      );
    }

    const subjectUrl =
      (typeof raw?.subjectUrl === "string" && raw.subjectUrl.trim()) ||
      (typeof raw?.imageUrl === "string" && raw.imageUrl.trim()) ||
      null;

    const clientRequestId =
      typeof raw?.clientRequestId === "string"
        ? raw.clientRequestId.trim().slice(0, 80)
        : undefined;

    const forced = coerceIntent(raw?.forceIntent || "");
    const forceIntent: AiEditIntent | undefined =
      forced !== "unknown" ? forced : undefined;

    const result = await runStudioCoreEngine({
      command,
      mode: raw?.mode,
      subjectUrl: unwrapMediaProxy(subjectUrl),
      backgroundUrl: unwrapMediaProxy(
        typeof raw?.backgroundUrl === "string" ? raw.backgroundUrl.trim() : null
      ),
      aspectRatio:
        typeof raw?.aspectRatio === "string" ? raw.aspectRatio : undefined,
      clientRequestId,
      forceIntent,
      maskUrl: unwrapMediaProxy(
        typeof raw?.maskUrl === "string" ? raw.maskUrl.trim() : null
      ),
      identityRefUrl: unwrapMediaProxy(
        typeof raw?.identityRefUrl === "string"
          ? raw.identityRefUrl.trim()
          : null
      ),
      strength:
        typeof raw?.strength === "number" && Number.isFinite(raw.strength)
          ? raw.strength
          : undefined,
      identityLock:
        typeof raw?.identityLock === "boolean" ? raw.identityLock : undefined,
      englishPromptOverride:
        typeof raw?.englishPromptOverride === "string"
          ? raw.englishPromptOverride.trim().slice(0, 4000)
          : undefined,
      formFields:
        raw?.formFields && typeof raw.formFields === "object"
          ? raw.formFields
          : null,
      styleSelection: normalizeVisualStyleSelection({
        imageStyleId:
          typeof raw?.imageStyleId === "string" ? raw.imageStyleId : null,
        moodStyleId:
          typeof raw?.moodStyleId === "string" ? raw.moodStyleId : null,
        styleIds: Array.isArray(raw?.styleIds) ? raw.styleIds : null,
      }),
    });

    if (!result.ok) {
      console.error("[api/ai/command] failed", {
        mode: result.mode,
        error: result.error,
        requestId: result.requestId,
        routerError: result.parsed.routerError?.code || null,
        message: result.message,
      });
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          message: result.message,
          mode: result.mode,
          profile: result.profile.label,
          intent: result.parsed.intent,
          kind: result.parsed.kind,
          prompt: result.parsed.prompt,
          englishPrompt: result.parsed.englishPrompt,
          language: result.parsed.language,
          requestId: result.requestId,
          routerError: result.parsed.routerError ?? null,
        },
        {
          status:
            result.error === "unknown_intent" ||
            result.error === "gemini_api_key_missing" ||
            result.error === "offline_translation_unavailable"
              ? 400
              : result.error.startsWith("gemini_")
                ? 503
                : 422,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      profile: result.profile.label,
      intent: result.parsed.intent,
      kind: result.parsed.kind,
      prompt: result.parsed.prompt,
      englishPrompt: result.parsed.englishPrompt,
      language: result.parsed.language,
      message: result.message,
      falPrompt: result.falPrompt,
      requestId: result.requestId,
      routerError: result.parsed.routerError ?? null,
      actions: result.actions,
    });
  } catch (error) {
    logFalApiError(error, { stage: "api_ai_command" });
    return NextResponse.json(
      {
        ok: false,
        error: "command_failed",
        message:
          error instanceof Error ? error.message : "Command pipeline failed",
      },
      { status: 500 }
    );
  }
}
