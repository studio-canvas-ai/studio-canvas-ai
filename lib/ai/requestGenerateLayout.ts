/**
 * Client helper for POST /api/generate-layout (Gemini Magic Layout).
 */

import type {
  GenerateLayoutRequest,
  PrintLayoutPlan,
} from "@/lib/ai/printLayoutEngine";

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

export async function requestGenerateLayout(
  params: GenerateLayoutRequest
): Promise<PrintLayoutPlan & { model?: string }> {
  const res = await fetch("/api/generate-layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

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
        "레이아웃 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      { status: res.status, code: data?.error || "layout_failed" }
    );
  }

  return {
    bg_prompt: data.bg_prompt,
    elements: data.elements,
    model: data.model,
  };
}
