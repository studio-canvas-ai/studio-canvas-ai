/**
 * Client helpers for conversational AI studio (cutout + command).
 * Each command call sends a fresh clientRequestId — no prompt reuse.
 */

import { toDisplayImageSrc } from "@/lib/resultSession";
import type { AiEditIntent } from "@/lib/ai/editIntents";

export type AiPlaneAction = {
  plane: "subject" | "background";
  imageUrl: string;
};

export type AiCommandResult = {
  intent: string;
  kind: string;
  prompt: string;
  englishPrompt?: string;
  language?: string;
  message: string;
  actions: AiPlaneAction[];
  falPrompt?: string | null;
  requestId?: string;
  routerError?: { code: string; message: string } | null;
};

export class AiStudioError extends Error {
  status: number;
  code: string;
  constructor(message: string, opts?: { status?: number; code?: string }) {
    super(message);
    this.name = "AiStudioError";
    this.status = opts?.status ?? 500;
    this.code = opts?.code ?? "ai_error";
  }
}

function isHttps(url: unknown): url is string {
  return typeof url === "string" && /^https:\/\//i.test(url.trim());
}

export function toRawImageUrl(url: string): string {
  const t = url.trim().replace(/#.*$/, "");
  if (t.startsWith("/api/media/fetch?")) {
    try {
      const q = new URL(t, "http://local.invalid").searchParams.get("src");
      if (q) return q;
    } catch {
      /* fall through */
    }
    try {
      return decodeURIComponent(t.slice("/api/media/fetch?src=".length));
    } catch {
      return t;
    }
  }
  return t;
}

function newClientRequestId(): string {
  return `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function processSubjectViaApi(image: string): Promise<string> {
  const res = await fetch("/api/ai/cutout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ image }),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    cutoutUrl?: string;
    imageUrl?: string;
    message?: string;
    error?: string;
  } | null;

  const url = data?.cutoutUrl || data?.imageUrl;
  if (!res.ok || !data?.ok || !isHttps(url)) {
    throw new AiStudioError(data?.message || "자동 누끼에 실패했습니다.", {
      status: res.status,
      code: data?.error || "cutout_failed",
    });
  }
  return url.trim();
}

export async function requestAiCommand(params: {
  command: string;
  subjectUrl?: string | null;
  backgroundUrl?: string | null;
  aspectRatio?: string;
  /** utility (template studio) | agent (print form) */
  mode?: "utility" | "agent" | string;
  maskUrl?: string | null;
  identityRefUrl?: string | null;
  strength?: number;
  formFields?: Record<string, string> | null;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
  styleIds?: string[] | null;
  /** Skip router intent and force masked inpaint / edit path. */
  forceIntent?: AiEditIntent;
  /** Override identity lock (false for scenic person-removal). */
  identityLock?: boolean;
  /** Skip Gemini rewrite — use this English as Fal prompt. */
  englishPromptOverride?: string | null;
}): Promise<AiCommandResult> {
  // Atomic: clone + trim only this command string (never append to a buffer).
  const command = params.command.trim();
  if (!command) {
    throw new AiStudioError("명령을 입력해 주세요.", {
      status: 400,
      code: "command_required",
    });
  }

  const clientRequestId = newClientRequestId();
  const englishPromptOverride = (params.englishPromptOverride || "")
    .trim()
    .slice(0, 4000);

  const res = await fetch("/api/ai/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      command,
      clientRequestId,
      mode: params.mode || "utility",
      subjectUrl: params.subjectUrl
        ? toRawImageUrl(params.subjectUrl)
        : undefined,
      backgroundUrl: params.backgroundUrl
        ? toRawImageUrl(params.backgroundUrl)
        : undefined,
      aspectRatio: params.aspectRatio,
      maskUrl: params.maskUrl
        ? toRawImageUrl(params.maskUrl)
        : undefined,
      identityRefUrl: params.identityRefUrl
        ? toRawImageUrl(params.identityRefUrl)
        : undefined,
      strength: params.strength,
      formFields: params.formFields || undefined,
      imageStyleId: params.imageStyleId || undefined,
      moodStyleId: params.moodStyleId || undefined,
      styleIds: params.styleIds || undefined,
      forceIntent: params.forceIntent || undefined,
      identityLock:
        typeof params.identityLock === "boolean"
          ? params.identityLock
          : undefined,
      englishPromptOverride: englishPromptOverride || undefined,
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    intent?: string;
    kind?: string;
    prompt?: string;
    englishPrompt?: string;
    language?: string;
    message?: string;
    falPrompt?: string | null;
    requestId?: string;
    actions?: AiPlaneAction[];
    error?: string;
    routerError?: { code: string; message: string } | null;
  } | null;

  if (!res.ok || !data?.ok || !Array.isArray(data.actions)) {
    const detail =
      data?.routerError?.message ||
      data?.message ||
      "명령 처리에 실패했습니다.";
    const code =
      data?.routerError?.code || data?.error || "command_failed";
    console.error("[aiCommand] failed", {
      status: res.status,
      code,
      message: detail,
      requestId: data?.requestId,
    });
    throw new AiStudioError(detail, {
      status: res.status,
      code,
    });
  }

  if (data.routerError) {
    console.warn("[aiCommand] router warning", data.routerError);
  }

  const actions = data.actions
    .filter(
      (a) =>
        a &&
        isHttps(a.imageUrl) &&
        (a.plane === "subject" || a.plane === "background")
    )
    .map((a) => ({
      plane: a.plane,
      imageUrl: a.imageUrl.trim(),
    }));

  return {
    intent: data.intent || "unknown",
    kind: data.kind || "Unknown",
    prompt: data.prompt || command,
    englishPrompt: data.englishPrompt,
    language: data.language,
    message: data.message || "완료",
    actions,
    falPrompt: data.falPrompt,
    requestId: data.requestId || clientRequestId,
    routerError: data.routerError ?? null,
  };
}

export function displayPlaneUrl(httpsUrl: string): string {
  return toDisplayImageSrc(httpsUrl);
}

/** Persist High-DPI composite / planes to R2 via /api/ai/print-export */
export async function requestPrintReadyExport(params: {
  planes: Array<{
    role?: "background" | "subject" | "composite" | "full";
    dataUrl?: string;
    imageUrl?: string;
    contentType?: string;
    width?: number;
    height?: number;
  }>;
  formatLabel?: string;
  dpi?: number;
  persist?: boolean;
  requestId?: string;
}): Promise<{
  requestId: string;
  dpi: number;
  persisted: boolean;
  r2Configured: boolean;
  assets: Array<{
    role: string;
    url: string | null;
    publicUrl: string | null;
    signedUrl: string | null;
    byteLength: number;
  }>;
  message: string;
}> {
  const res = await fetch("/api/ai/print-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    requestId?: string;
    dpi?: number;
    persisted?: boolean;
    r2Configured?: boolean;
    assets?: Array<{
      role: string;
      url?: string | null;
      publicUrl?: string | null;
      signedUrl?: string | null;
      byteLength?: number;
    }>;
    message?: string;
    error?: string;
  } | null;

  if (!res.ok || !data?.ok) {
    throw new AiStudioError(
      data?.message || "인쇄용 고해상도 저장에 실패했습니다.",
      { status: res.status, code: data?.error || "print_export_failed" }
    );
  }

  return {
    requestId: data.requestId || newClientRequestId(),
    dpi: data.dpi || 300,
    persisted: Boolean(data.persisted),
    r2Configured: Boolean(data.r2Configured),
    assets: (data.assets || []).map((a) => ({
      role: a.role,
      url: a.url ?? a.signedUrl ?? a.publicUrl ?? null,
      publicUrl: a.publicUrl ?? null,
      signedUrl: a.signedUrl ?? null,
      byteLength: a.byteLength || 0,
    })),
    message: data.message || "ok",
  };
}

