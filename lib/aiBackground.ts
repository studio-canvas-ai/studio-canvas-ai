/**
 * Client helper for POST /api/ai-background (Fal text-to-image backgrounds).
 */

export type AiBackgroundRequest = {
  /** User keyword / scene description — sent as both `prompt` and `keyword`. */
  prompt: string;
  aspectRatio?: string;
  pageIndex?: number;
  pageCount?: number;
  imageStyleId?: string | null;
  moodStyleId?: string | null;
};

export type AiBackgroundResult = {
  imageUrl: string;
  images: string[];
  /** Echo of the trimmed user prompt the API received. */
  prompt: string;
  /** Full prompt string sent to Fal (user text first). */
  falPrompt?: string;
};

export class AiBackgroundError extends Error {
  status: number;
  code: string;

  constructor(message: string, opts?: { status?: number; code?: string }) {
    super(message);
    this.name = "AiBackgroundError";
    this.status = opts?.status ?? 500;
    this.code = opts?.code ?? "generation_failed";
  }
}

function isRealGeneratedUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const u = url.trim();
  if (!/^https:\/\//i.test(u)) return false;
  // Block local hero samples / relative paths masquerading as results.
  if (u.includes("/hero/") || u.startsWith("/") || u.startsWith("data:")) {
    return false;
  }
  return true;
}

export async function requestAiBackground(
  params: AiBackgroundRequest
): Promise<AiBackgroundResult> {
  const prompt = params.prompt.trim();
  if (!prompt) {
    throw new AiBackgroundError("키워드를 입력해 주세요.", {
      status: 400,
      code: "prompt_required",
    });
  }

  const res = await fetch("/api/ai-background", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      prompt,
      keyword: prompt,
      ...(params.aspectRatio ? { aspectRatio: params.aspectRatio } : {}),
      ...(typeof params.pageIndex === "number"
        ? { pageIndex: params.pageIndex }
        : {}),
      ...(typeof params.pageCount === "number"
        ? { pageCount: params.pageCount }
        : {}),
      ...(params.imageStyleId
        ? { imageStyleId: params.imageStyleId }
        : {}),
      ...(params.moodStyleId ? { moodStyleId: params.moodStyleId } : {}),
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    imageUrl?: string;
    images?: string[];
    prompt?: string;
    falPrompt?: string;
    error?: string;
    message?: string;
  } | null;

  if (!res.ok || !data?.ok) {
    throw new AiBackgroundError(
      data?.message || "AI 배경 생성에 실패했습니다.",
      { status: res.status, code: data?.error || "generation_failed" }
    );
  }

  const imageUrl = isRealGeneratedUrl(data.imageUrl)
    ? data.imageUrl.trim()
    : (data.images || []).find(isRealGeneratedUrl);

  if (!imageUrl) {
    throw new AiBackgroundError(
      "생성된 이미지 URL을 받지 못했습니다. 샘플 이미지는 사용하지 않습니다.",
      { status: 502, code: "invalid_image_url" }
    );
  }

  if (data.prompt && data.prompt !== prompt) {
    console.warn("[ai-background] prompt mismatch", {
      sent: prompt,
      received: data.prompt,
    });
  }

  console.info("[ai-background] client received", {
    prompt: data.prompt || prompt,
    falPrompt: data.falPrompt,
    imageHost: (() => {
      try {
        return new URL(imageUrl).host;
      } catch {
        return "invalid";
      }
    })(),
  });

  return {
    imageUrl,
    images: (data.images || [imageUrl]).filter(isRealGeneratedUrl),
    prompt: data.prompt || prompt,
    falPrompt: data.falPrompt,
  };
}
