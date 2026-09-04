/**
 * Client helper for POST /api/generate-layout (Gemini Magic Layout).
 */

import type {
  GenerateLayoutRequest,
  PrintLayoutPlan,
} from "@/lib/ai/printLayoutEngine";

/** Mobile networks + Gemini often exceed 30–60s; keep under server maxDuration (120). */
const GENERATE_LAYOUT_TIMEOUT_MS = 110_000;
const GENERATE_LAYOUT_RETRIES = 1;

export class GenerateLayoutError extends Error {
  status: number;
  code: string;

  constructor(message: string, opts?: { status?: number; code?: string }) {
    super(message);
    this.name = "GenerateLayoutError";
    this.status = opts?.status ?? 500;
    this.code = opts?.code ?? "layout_failed";
  }
}

const DEFAULT_CANVAS = { w: 1080, h: 1528 } as const;

/**
 * Guarantee a backend-safe payload even when mobile state omits fields
 * (IME not committed, null format/custom size, NaN stage size, etc.).
 */
export function normalizeGenerateLayoutRequest(
  params: Partial<GenerateLayoutRequest> | null | undefined
): GenerateLayoutRequest {
  const promptRaw =
    typeof params?.prompt === "string" ? params.prompt.trim() : "";
  const formatLabel =
    typeof params?.formatLabel === "string" && params.formatLabel.trim()
      ? params.formatLabel.trim()
      : "A4";
  const styleLabel =
    typeof params?.styleLabel === "string" && params.styleLabel.trim()
      ? params.styleLabel.trim()
      : "모던";
  const useLabel =
    typeof params?.useLabel === "string" && params.useLabel.trim()
      ? params.useLabel.trim()
      : "전단지";
  const backgroundFieldLabel =
    typeof params?.backgroundFieldLabel === "string" &&
    params.backgroundFieldLabel.trim()
      ? params.backgroundFieldLabel.trim()
      : "일반";
  const categoryLabel =
    typeof params?.categoryLabel === "string" && params.categoryLabel.trim()
      ? params.categoryLabel.trim()
      : undefined;

  let canvasWidth = Number(params?.canvasWidth);
  let canvasHeight = Number(params?.canvasHeight);
  if (
    !Number.isFinite(canvasWidth) ||
    !Number.isFinite(canvasHeight) ||
    canvasWidth < 64 ||
    canvasHeight < 64
  ) {
    canvasWidth = DEFAULT_CANVAS.w;
    canvasHeight = DEFAULT_CANVAS.h;
  }

  const prompt =
    promptRaw ||
    [formatLabel, useLabel, backgroundFieldLabel, styleLabel]
      .filter(Boolean)
      .join(" · ") ||
    "elegant print design";

  const pageIndex =
    typeof params?.pageIndex === "number" && Number.isFinite(params.pageIndex)
      ? Math.max(0, Math.floor(params.pageIndex))
      : undefined;
  const pageCount =
    typeof params?.pageCount === "number" && Number.isFinite(params.pageCount)
      ? Math.max(1, Math.min(10, Math.floor(params.pageCount)))
      : undefined;

  return {
    formatLabel,
    styleLabel,
    useLabel,
    backgroundFieldLabel,
    categoryLabel,
    prompt,
    canvasWidth,
    canvasHeight,
    pageIndex,
    pageCount,
  };
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof GenerateLayoutError) {
    return isRetryableStatus(err.status) || err.code === "timeout" || err.code === "network";
  }
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === "AbortError" ||
    /failed to fetch|networkerror|load failed|timed out|timeout/i.test(msg)
  );
}

async function fetchGenerateLayoutOnce(
  body: GenerateLayoutRequest,
  signal: AbortSignal
): Promise<PrintLayoutPlan & { model?: string }> {
  let res: Response;
  try {
    res = await fetch("/api/generate-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new GenerateLayoutError(
        "레이아웃 생성 시간이 초과되었습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
        { status: 408, code: "timeout" }
      );
    }
    throw new GenerateLayoutError(
      "네트워크 연결이 불안정합니다. Wi-Fi/데이터를 확인한 뒤 다시 시도해 주세요.",
      { status: 0, code: "network" }
    );
  }

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    bg_prompt?: string;
    elements?: PrintLayoutPlan["elements"];
    model?: string;
    error?: string;
    message?: string;
  } | null;

  if (!res.ok || !data?.ok || !data.bg_prompt || !Array.isArray(data.elements)) {
    throw new GenerateLayoutError(
      data?.message ||
        data?.error ||
        (res.status >= 500
          ? "레이아웃 서버 응답이 지연되거나 불완전합니다. 잠시 후 다시 시도해 주세요."
          : "레이아웃 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."),
      { status: res.status, code: data?.error || "layout_failed" }
    );
  }

  return {
    bg_prompt: data.bg_prompt,
    elements: data.elements,
    model: data.model,
  };
}

export async function requestGenerateLayout(
  params: Partial<GenerateLayoutRequest>
): Promise<PrintLayoutPlan & { model?: string }> {
  const body = normalizeGenerateLayoutRequest(params);
  let lastError: unknown;

  for (let attempt = 0; attempt <= GENERATE_LAYOUT_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      GENERATE_LAYOUT_TIMEOUT_MS
    );
    try {
      return await fetchGenerateLayoutOnce(body, controller.signal);
    } catch (err) {
      lastError = err;
      const retry =
        attempt < GENERATE_LAYOUT_RETRIES && isRetryableNetworkError(err);
      if (!retry) break;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError instanceof GenerateLayoutError) throw lastError;
  throw new GenerateLayoutError(
    lastError instanceof Error
      ? lastError.message
      : "레이아웃 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
  );
}
