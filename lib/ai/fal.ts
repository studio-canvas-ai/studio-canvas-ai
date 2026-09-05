/**
 * Fal.ai FLUX.1 Kontext [pro] client (HTTP).
 *
 * Model ID (official): `fal-ai/flux-pro/kontext`
 * Sync:  POST https://fal.run/fal-ai/flux-pro/kontext
 * Queue: POST https://queue.fal.run/fal-ai/flux-pro/kontext
 * Auth:  Authorization: Key $FAL_KEY
 *
 * Input (per https://fal.ai/models/fal-ai/flux-pro/kontext/api):
 *   prompt (string, required)
 *   image_url (string, required) — https URL or data URI
 *   guidance_scale?, num_images?, output_format?, safety_tolerance?,
 *   enhance_prompt?, aspect_ratio?, seed?, sync_mode?
 */

export const FAL_FLUX_KONTEXT_PRO = "fal-ai/flux-pro/kontext" as const;
/** InstantID — mandatory face_image_url + IP-Adapter FaceID (lookbook). */
export const FAL_INSTANT_ID = "fal-ai/instantid" as const;
/** Text-to-image for AI studio / print backgrounds (no reference image). */
export const FAL_FLUX_DEV = "fal-ai/flux/dev" as const;
/** Portrait-friendly background removal (transparent PNG). */
export const FAL_BIREFNET = "fal-ai/birefnet/v2" as const;

/** Reject non-HTTPS or local URLs from Fal CDN responses. */
export function validateFalResultUrl(
  url: unknown,
  stage = "fal_result"
): string {
  if (typeof url !== "string" || !url.trim()) {
    throw Object.assign(new Error(`${stage}_empty_url`), {
      code: "fal_empty_url",
    });
  }
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    throw Object.assign(new Error(`${stage}_not_https`), {
      code: "fal_invalid_url",
    });
  }
  if (/^https:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(trimmed)) {
    throw Object.assign(new Error(`${stage}_local_url`), {
      code: "fal_local_url",
    });
  }
  return trimmed;
}

function validateFalImages(images: FalImage[], stage: string): FalImage[] {
  return images.map((img) => ({
    ...img,
    url: validateFalResultUrl(img.url, stage),
  }));
}
/** Masked inpaint with reference identity (wardrobe / local edits). */
export const FAL_FLUX_KONTEXT_INPAINT = "fal-ai/flux-kontext-lora/inpaint" as const;

export type FalKontextAspectRatio =
  | "21:9"
  | "16:9"
  | "4:3"
  | "3:2"
  | "1:1"
  | "2:3"
  | "3:4"
  | "9:16"
  | "9:21";

export type FalImageSizePreset =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

export type FalTextToImageInput = {
  prompt: string;
  image_size?: FalImageSizePreset | { width: number; height: number };
  num_images?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  output_format?: "jpeg" | "png";
  seed?: number;
  enable_safety_checker?: boolean;
};

export type FalKontextInput = {
  prompt: string;
  image_url: string;
  guidance_scale?: number;
  num_images?: number;
  output_format?: "jpeg" | "png";
  safety_tolerance?: "1" | "2" | "3" | "4" | "5" | "6";
  enhance_prompt?: boolean;
  aspect_ratio?: FalKontextAspectRatio;
  seed?: number;
  sync_mode?: boolean;
};

/** Identity-preserving masked inpaint (Kontext LoRA inpaint). */
export type FalKontextInpaintInput = {
  prompt: string;
  image_url: string;
  mask_url: string;
  /** Face / identity reference — defaults to image_url when omitted. */
  reference_image_url?: string;
  /** Denoising strength 0.01–1 (lower keeps more of the original). */
  strength?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  num_images?: number;
  output_format?: "jpeg" | "png";
  seed?: number;
  enable_safety_checker?: boolean;
};

export type FalImage = {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
};

export type FalKontextResult = {
  images: FalImage[];
  prompt?: string;
  seed?: number;
  requestId?: string;
  raw?: unknown;
};

/** Prefer structured Fal / axios-like payloads in Vercel logs. */
export function logFalApiError(error: unknown, context?: Record<string, unknown>) {
  const anyErr = error as {
    response?: { data?: unknown; status?: number };
    status?: number;
    data?: unknown;
    message?: string;
    body?: unknown;
  };
  const payload =
    anyErr?.response?.data ??
    anyErr?.data ??
    anyErr?.body ??
    error;
  console.error("Fal API Error:", payload || error, context || "");
}

function falKey(): string {
  let key =
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim() ||
    "";
  // Allow pasting "Key xxx" from the dashboard into env.
  if (key.toLowerCase().startsWith("key ")) {
    key = key.slice(4).trim();
  }
  return key;
}

export function hasFalCredentials(): boolean {
  return Boolean(falKey());
}

export function mapAspectRatioToFal(aspectRatio: string): FalKontextAspectRatio {
  switch (aspectRatio) {
    case "1:1":
      return "1:1";
    case "4:3":
      return "4:3";
    case "3:4":
      return "3:4";
    case "16:9":
      return "16:9";
    case "id":
    case "3.5:4.5":
      return "3:4";
    case "9:16":
    default:
      return "9:16";
  }
}

/** Map studio / print aspect keys to Fal Flux `image_size` presets. */
export function mapAspectToFalImageSize(
  aspectRatio?: string | null
): FalImageSizePreset {
  const key = (aspectRatio || "").trim().toLowerCase();
  switch (key) {
    case "1:1":
    case "square":
      return "square_hd";
    case "16:9":
    case "4:1":
    case "3:1":
      return "landscape_16_9";
    case "4:3":
      return "landscape_4_3";
    case "3:4":
    case "4:5":
    case "id":
    case "a4":
    case "a3":
    case "a2":
    case "3.5:4.5":
      return "portrait_4_3";
    case "9:16":
      return "portrait_16_9";
    default:
      break;
  }
  if (key.includes(":")) {
    const [wRaw, hRaw] = key.split(":");
    const w = Number(wRaw);
    const h = Number(hRaw);
    if (w > 0 && h > 0) {
      const ratio = w / h;
      if (Math.abs(ratio - 1) < 0.08) return "square_hd";
      return ratio > 1 ? "landscape_16_9" : "portrait_16_9";
    }
  }
  const numeric = Number(key);
  if (Number.isFinite(numeric) && numeric > 0) {
    if (Math.abs(numeric - 1) < 0.08) return "square_hd";
    return numeric > 1 ? "landscape_16_9" : "portrait_16_9";
  }
  return "square_hd";
}

function authHeader(key: string): string {
  return `Key ${key}`;
}

/** Flatten FastAPI / Fal `detail` arrays into a readable string. */
export function formatFalErrorBody(raw: unknown, httpStatus?: number): string {
  if (raw == null) return httpStatus ? `Fal HTTP ${httpStatus}` : "Fal request failed";
  if (typeof raw === "string") return raw;
  if (typeof raw !== "object") return String(raw);

  const obj = raw as Record<string, unknown>;
  const detail = obj.detail ?? obj.error ?? obj.message;

  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const row = item as { msg?: string; loc?: unknown; type?: string };
        const loc = Array.isArray(row.loc) ? row.loc.join(".") : "";
        return [loc, row.msg || row.type].filter(Boolean).join(": ");
      }
      return JSON.stringify(item);
    });
    if (parts.length) return parts.join("; ");
  }
  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      /* fall through */
    }
  }

  try {
    return JSON.stringify(obj).slice(0, 2000);
  } catch {
    return httpStatus ? `Fal HTTP ${httpStatus}` : "Fal request failed";
  }
}

function summarizeImageUrl(url: string): Record<string, unknown> {
  if (!url) return { kind: "empty" };
  if (url.startsWith("data:")) {
    const mime = url.slice(5, url.indexOf(";")) || "unknown";
    return {
      kind: "data_uri",
      mime,
      chars: url.length,
      approxBytes: Math.floor((url.length * 3) / 4),
    };
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { kind: "https", host: safeHost(url), chars: url.length };
  }
  return { kind: "other", prefix: url.slice(0, 32), chars: url.length };
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

function summarizeInput(input: FalKontextInput): Record<string, unknown> {
  return {
    promptChars: input.prompt?.length ?? 0,
    promptPreview: (input.prompt || "").slice(0, 120),
    image: summarizeImageUrl(input.image_url || ""),
    guidance_scale: input.guidance_scale,
    num_images: input.num_images,
    output_format: input.output_format,
    safety_tolerance: input.safety_tolerance,
    enhance_prompt: input.enhance_prompt,
    aspect_ratio: input.aspect_ratio,
  };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Upload data-URI / oversized images to Fal CDN so Kontext receives a public https URL.
 * Large inline base64 payloads often fail validation or hit gateway body limits.
 */
export async function ensureFalHttpsImageUrl(imageUrl: string): Promise<string> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY missing");

  const trimmed = imageUrl.trim();
  if (!trimmed) throw new Error("image_url_required");

  // Public https — use as-is (Fal fetches it).
  if (/^https:\/\//i.test(trimmed)) return trimmed;

  // Prefer uploading data URIs (and rare http://) to Fal storage.
  const shouldUpload =
    trimmed.startsWith("data:") || /^http:\/\//i.test(trimmed);
  if (!shouldUpload) {
    // Relative paths etc. — leave to caller; Kontext needs absolute URL.
    throw new Error(
      `Fal image_url must be https or data URI (got ${trimmed.slice(0, 24)}…)`
    );
  }

  let bytes: Uint8Array;
  let contentType = "image/jpeg";
  let fileName = `face-${Date.now()}.jpg`;

  if (trimmed.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
    if (!match) throw new Error("invalid_data_uri");
    contentType = match[1] || "image/jpeg";
    const ext =
      contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
    fileName = `face-${Date.now()}.${ext}`;
    bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  } else {
    const res = await fetch(trimmed, { cache: "no-store" });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logFalApiError(
        { response: { data: errBody || `HTTP ${res.status}`, status: res.status } },
        { stage: "fetch_source_image" }
      );
      throw new Error(`Failed to fetch source image (HTTP ${res.status})`);
    }
    contentType = res.headers.get("content-type") || "image/jpeg";
    bytes = new Uint8Array(await res.arrayBuffer());
  }

  if (bytes.byteLength < 32) {
    throw new Error("image_bytes_too_small");
  }

  const initiateRes = await fetch(
    "https://rest.alpha.fal.ai/storage/upload/initiate",
    {
      method: "POST",
      headers: {
        Authorization: authHeader(key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content_type: contentType,
        file_name: fileName,
      }),
    }
  );
  const initiateRaw = await readJsonSafe(initiateRes);
  if (!initiateRes.ok) {
    logFalApiError(
      { response: { data: initiateRaw, status: initiateRes.status } },
      { stage: "storage_upload_initiate", contentType, bytes: bytes.byteLength }
    );
    throw new Error(
      formatFalErrorBody(initiateRaw, initiateRes.status) ||
        `Fal storage initiate HTTP ${initiateRes.status}`
    );
  }

  const uploadUrl =
    (initiateRaw as { upload_url?: string; uploadUrl?: string })?.upload_url ||
    (initiateRaw as { uploadUrl?: string })?.uploadUrl;
  const fileUrl =
    (initiateRaw as { file_url?: string; fileUrl?: string })?.file_url ||
    (initiateRaw as { fileUrl?: string })?.fileUrl;

  if (!uploadUrl || !fileUrl) {
    logFalApiError(
      { response: { data: initiateRaw } },
      { stage: "storage_upload_initiate_missing_urls" }
    );
    throw new Error("Fal storage initiate missing upload_url/file_url");
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: Buffer.from(bytes),
  });
  if (!putRes.ok) {
    const putText = await putRes.text().catch(() => "");
    logFalApiError(
      { response: { data: putText || `HTTP ${putRes.status}`, status: putRes.status } },
      { stage: "storage_upload_put", bytes: bytes.byteLength }
    );
    throw new Error(`Fal storage PUT failed (HTTP ${putRes.status})`);
  }

  console.info("[fal] uploaded face image to CDN", {
    fileUrlHost: safeHost(fileUrl),
    bytes: bytes.byteLength,
    contentType,
  });
  return fileUrl;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

type FalQueueSubmit = {
  request_id?: string;
  status_url?: string;
  response_url?: string;
  detail?: unknown;
  error?: unknown;
  status?: string;
};

type FalQueueStatus = {
  status?: string;
  response_url?: string;
  error?: unknown;
  detail?: unknown;
  logs?: Array<{ message?: string }>;
};

/**
 * Run FLUX.1 Kontext [pro] with docs-aligned payload.
 * Uploads data-URI faces to Fal storage, then uses queue when sync is incomplete.
 */
export async function runFalFluxKontextPro(
  input: FalKontextInput,
  opts?: { model?: string; timeoutMs?: number }
): Promise<FalKontextResult> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY missing");

  const model = (
    opts?.model ||
    process.env.FAL_FLUX_MODEL?.trim() ||
    FAL_FLUX_KONTEXT_PRO
  ).replace(/^\//, "");

  const timeoutMs = opts?.timeoutMs ?? 110_000;
  const started = Date.now();

  let imageUrl = input.image_url;
  try {
    imageUrl = await ensureFalHttpsImageUrl(input.image_url);
  } catch (error) {
    logFalApiError(
      (error as { response?: unknown })?.response
        ? error
        : { response: { data: error instanceof Error ? error.message : error } },
      { stage: "ensure_image_url", image: summarizeImageUrl(input.image_url) }
    );
    throw error instanceof Error ? error : new Error(String(error));
  }

  // Docs default num_images=1; allow 1–4. Prefer 1 for reliability on Vercel time budgets.
  const numImages = Math.max(1, Math.min(4, input.num_images ?? 1));

  const body: FalKontextInput = {
    prompt: input.prompt,
    image_url: imageUrl,
    guidance_scale:
      typeof input.guidance_scale === "number" ? input.guidance_scale : 3.5,
    num_images: numImages,
    output_format: input.output_format || "jpeg",
    safety_tolerance: input.safety_tolerance || "2",
    enhance_prompt: Boolean(input.enhance_prompt),
    ...(input.aspect_ratio ? { aspect_ratio: input.aspect_ratio } : {}),
    ...(typeof input.seed === "number" ? { seed: input.seed } : {}),
  };

  console.info("[fal] kontext request", {
    model,
    endpoint: `https://fal.run/${model}`,
    input: summarizeInput(body),
  });

  try {
    // 1) Prefer sync fal.run (returns images when ready).
    const runRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const runRaw = await readJsonSafe(runRes);

    if (runRes.ok) {
      const images = extractFalImages(runRaw);
      if (images.length) {
        return {
          images,
          prompt: body.prompt,
          seed: (runRaw as { seed?: number })?.seed,
          raw: runRaw,
        };
      }
      // 200 without images — fall through to queue if request_id present.
    } else if (runRes.status !== 202 && runRes.status !== 409) {
      logFalApiError(
        { response: { data: runRaw, status: runRes.status } },
        { stage: "fal_run", model, input: summarizeInput(body) }
      );
      // Non-queueable error — still try queue once for transient 5xx, else throw.
      if (runRes.status >= 400 && runRes.status < 500 && runRes.status !== 429) {
        throw Object.assign(
          new Error(formatFalErrorBody(runRaw, runRes.status)),
          { response: { data: runRaw, status: runRes.status } }
        );
      }
    }

    const submitted = (runRaw || {}) as FalQueueSubmit;
    let requestId = submitted.request_id;
    let statusUrl = submitted.status_url;
    let resultUrl = submitted.response_url;

    // 2) Explicit queue submit when sync did not finish.
    if (!requestId) {
      const qRes = await fetch(`https://queue.fal.run/${model}`, {
        method: "POST",
        headers: {
          Authorization: authHeader(key),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const qRaw = await readJsonSafe(qRes);
      if (!qRes.ok) {
        logFalApiError(
          { response: { data: qRaw, status: qRes.status } },
          { stage: "queue_submit", model, input: summarizeInput(body) }
        );
        throw Object.assign(
          new Error(formatFalErrorBody(qRaw, qRes.status)),
          { response: { data: qRaw, status: qRes.status } }
        );
      }
      const q = qRaw as FalQueueSubmit;
      requestId = q.request_id;
      statusUrl = q.status_url;
      resultUrl = q.response_url;
    }

    if (!requestId) {
      logFalApiError(
        { response: { data: runRaw } },
        { stage: "missing_request_id", model }
      );
      throw Object.assign(new Error("Fal returned no images and no request_id"), {
        response: { data: runRaw },
      });
    }

    statusUrl =
      statusUrl ||
      `https://queue.fal.run/${model}/requests/${requestId}/status`;
    resultUrl =
      resultUrl || `https://queue.fal.run/${model}/requests/${requestId}`;

    while (Date.now() - started < timeoutMs) {
      await sleep(1500);
      const stRes = await fetch(`${statusUrl}?logs=1`, {
        headers: { Authorization: authHeader(key) },
        cache: "no-store",
      });
      const st = (await readJsonSafe(stRes)) as FalQueueStatus;
      if (!stRes.ok) {
        logFalApiError(
          { response: { data: st, status: stRes.status } },
          { stage: "queue_status", requestId }
        );
        continue;
      }

      const status = (st.status || "").toUpperCase();
      if (status === "COMPLETED" || status === "OK") {
        const outRes = await fetch(resultUrl, {
          headers: { Authorization: authHeader(key) },
          cache: "no-store",
        });
        const outRaw = await readJsonSafe(outRes);
        if (!outRes.ok) {
          logFalApiError(
            { response: { data: outRaw, status: outRes.status } },
            { stage: "queue_result", requestId }
          );
          throw Object.assign(
            new Error(formatFalErrorBody(outRaw, outRes.status)),
            { response: { data: outRaw, status: outRes.status } }
          );
        }
        const images = extractFalImages(outRaw);
        if (!images.length) {
          logFalApiError(
            { response: { data: outRaw } },
            { stage: "queue_result_empty", requestId }
          );
          throw Object.assign(new Error("Fal completed but returned no images"), {
            response: { data: outRaw },
          });
        }
        return {
          images,
          prompt: body.prompt,
          seed: (outRaw as { seed?: number })?.seed,
          requestId,
          raw: outRaw,
        };
      }

      if (
        status === "FAILED" ||
        status === "CANCELLED" ||
        status === "CANCELED" ||
        status === "ERROR"
      ) {
        logFalApiError(
          { response: { data: st, status: stRes.status } },
          { stage: "queue_failed", requestId, status }
        );
        throw Object.assign(
          new Error(formatFalErrorBody(st, stRes.status) || `Fal job ${status}`),
          { response: { data: st } }
        );
      }
    }

    const timeoutErr = new Error("Fal Flux Kontext Pro timed out");
    logFalApiError(
      { response: { data: { message: timeoutErr.message, requestId } } },
      { stage: "timeout", model, elapsedMs: Date.now() - started }
    );
    throw Object.assign(timeoutErr, {
      response: { data: { message: timeoutErr.message, requestId } },
    });
  } catch (error) {
    // Ensure every unexpected throw is visible in Vercel logs with the requested shape.
    const alreadyLogged =
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: unknown }).response;
    if (!alreadyLogged) {
      logFalApiError(error, { stage: "unhandled", model });
    } else {
      logFalApiError(error, { stage: "rethrow", model });
    }
    throw error;
  }
}

/**
 * FLUX.1 [dev] text-to-image — used for AI background generation (prompt only).
 * Auth: FAL_KEY or FAL_API_KEY.
 */
export async function runFalFluxTextToImage(
  input: FalTextToImageInput,
  opts?: { model?: string; timeoutMs?: number }
): Promise<FalKontextResult> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY missing");

  const model = (
    opts?.model ||
    process.env.FAL_BG_MODEL?.trim() ||
    FAL_FLUX_DEV
  ).replace(/^\//, "");

  const timeoutMs = opts?.timeoutMs ?? 110_000;
  const started = Date.now();
  const numImages = Math.max(1, Math.min(4, input.num_images ?? 1));

  const body: FalTextToImageInput = {
    prompt: input.prompt,
    image_size: input.image_size || "square_hd",
    num_images: numImages,
    num_inference_steps:
      typeof input.num_inference_steps === "number"
        ? input.num_inference_steps
        : 28,
    guidance_scale:
      typeof input.guidance_scale === "number" ? input.guidance_scale : 3.5,
    output_format: input.output_format || "jpeg",
    enable_safety_checker: input.enable_safety_checker !== false,
    ...(typeof input.seed === "number" ? { seed: input.seed } : {}),
  };

  console.info("[fal] text-to-image request", {
    model,
    endpoint: `https://fal.run/${model}`,
    prompt: body.prompt.slice(0, 160),
    image_size: body.image_size,
  });

  try {
    const runRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const runRaw = await readJsonSafe(runRes);

    if (runRes.ok) {
      const images = extractFalImages(runRaw);
      if (images.length) {
        return {
          images,
          prompt: body.prompt,
          seed: (runRaw as { seed?: number })?.seed,
          raw: runRaw,
        };
      }
    } else if (runRes.status !== 202 && runRes.status !== 409) {
      logFalApiError(
        { response: { data: runRaw, status: runRes.status } },
        { stage: "fal_run_t2i", model }
      );
      if (runRes.status >= 400 && runRes.status < 500 && runRes.status !== 429) {
        throw Object.assign(
          new Error(formatFalErrorBody(runRaw, runRes.status)),
          { response: { data: runRaw, status: runRes.status } }
        );
      }
    }

    const submitted = (runRaw || {}) as FalQueueSubmit;
    let requestId = submitted.request_id;
    let statusUrl = submitted.status_url;
    let resultUrl = submitted.response_url;

    if (!requestId) {
      const qRes = await fetch(`https://queue.fal.run/${model}`, {
        method: "POST",
        headers: {
          Authorization: authHeader(key),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const qRaw = await readJsonSafe(qRes);
      if (!qRes.ok) {
        logFalApiError(
          { response: { data: qRaw, status: qRes.status } },
          { stage: "queue_submit_t2i", model }
        );
        throw Object.assign(
          new Error(formatFalErrorBody(qRaw, qRes.status)),
          { response: { data: qRaw, status: qRes.status } }
        );
      }
      const q = qRaw as FalQueueSubmit;
      requestId = q.request_id;
      statusUrl = q.status_url;
      resultUrl = q.response_url;
    }

    if (!requestId) {
      throw Object.assign(new Error("Fal returned no images and no request_id"), {
        response: { data: runRaw },
      });
    }

    statusUrl =
      statusUrl ||
      `https://queue.fal.run/${model}/requests/${requestId}/status`;
    resultUrl =
      resultUrl || `https://queue.fal.run/${model}/requests/${requestId}`;

    while (Date.now() - started < timeoutMs) {
      await sleep(1500);
      const stRes = await fetch(`${statusUrl}?logs=1`, {
        headers: { Authorization: authHeader(key) },
        cache: "no-store",
      });
      const st = (await readJsonSafe(stRes)) as FalQueueStatus;
      if (!stRes.ok) continue;

      const status = (st.status || "").toUpperCase();
      if (status === "COMPLETED" || status === "OK") {
        const outRes = await fetch(resultUrl, {
          headers: { Authorization: authHeader(key) },
          cache: "no-store",
        });
        const outRaw = await readJsonSafe(outRes);
        if (!outRes.ok) {
          throw Object.assign(
            new Error(formatFalErrorBody(outRaw, outRes.status)),
            { response: { data: outRaw, status: outRes.status } }
          );
        }
        const images = extractFalImages(outRaw);
        if (!images.length) {
          throw Object.assign(new Error("Fal completed but returned no images"), {
            response: { data: outRaw },
          });
        }
        return {
          images,
          prompt: body.prompt,
          seed: (outRaw as { seed?: number })?.seed,
          requestId,
          raw: outRaw,
        };
      }

      if (
        status === "FAILED" ||
        status === "CANCELLED" ||
        status === "CANCELED" ||
        status === "ERROR"
      ) {
        throw Object.assign(
          new Error(formatFalErrorBody(st, stRes.status) || `Fal job ${status}`),
          { response: { data: st } }
        );
      }
    }

    throw Object.assign(new Error("Fal text-to-image timed out"), {
      response: { data: { message: "timeout", requestId } },
    });
  } catch (error) {
    const alreadyLogged =
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: unknown }).response;
    if (!alreadyLogged) {
      logFalApiError(error, { stage: "unhandled_t2i", model });
    }
    throw error;
  }
}

/**
 * FLUX.1 Kontext LoRA inpaint — mask + reference identity for wardrobe / local edits.
 * Model: fal-ai/flux-kontext-lora/inpaint
 */
export async function runFalFluxKontextInpaint(
  input: FalKontextInpaintInput,
  opts?: { model?: string; timeoutMs?: number }
): Promise<FalKontextResult> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY missing");

  const model = (
    opts?.model ||
    process.env.FAL_INPAINT_MODEL?.trim() ||
    FAL_FLUX_KONTEXT_INPAINT
  ).replace(/^\//, "");

  const timeoutMs = opts?.timeoutMs ?? 110_000;
  const started = Date.now();

  const imageUrl = await ensureFalHttpsImageUrl(input.image_url);
  const maskUrl = await ensureFalHttpsImageUrl(input.mask_url);
  const referenceUrl = input.reference_image_url
    ? await ensureFalHttpsImageUrl(input.reference_image_url)
    : imageUrl;

  const strength = Math.max(
    0.01,
    Math.min(1, typeof input.strength === "number" ? input.strength : 0.72)
  );

  const body: Record<string, unknown> = {
    prompt: input.prompt,
    image_url: imageUrl,
    mask_url: maskUrl,
    reference_image_url: referenceUrl,
    strength,
    guidance_scale:
      typeof input.guidance_scale === "number" ? input.guidance_scale : 2.5,
    num_inference_steps:
      typeof input.num_inference_steps === "number"
        ? input.num_inference_steps
        : 30,
    num_images: Math.max(1, Math.min(4, input.num_images ?? 1)),
    output_format: input.output_format || "png",
    enable_safety_checker: input.enable_safety_checker !== false,
    ...(typeof input.seed === "number" ? { seed: input.seed } : {}),
  };

  console.info("[fal] kontext-inpaint request", {
    model,
    strength,
    guidance_scale: body.guidance_scale,
    prompt: String(body.prompt).slice(0, 160),
  });

  try {
    const runRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const runRaw = await readJsonSafe(runRes);

    if (runRes.ok) {
      const images = extractFalImages(runRaw);
      if (images.length) {
        return {
          images,
          prompt: String(body.prompt),
          seed: (runRaw as { seed?: number })?.seed,
          raw: runRaw,
        };
      }
    } else if (runRes.status !== 202 && runRes.status !== 409) {
      logFalApiError(
        { response: { data: runRaw, status: runRes.status } },
        { stage: "fal_run_inpaint", model }
      );
      if (runRes.status >= 400 && runRes.status < 500 && runRes.status !== 429) {
        throw Object.assign(
          new Error(formatFalErrorBody(runRaw, runRes.status)),
          { response: { data: runRaw, status: runRes.status } }
        );
      }
    }

    const queueRes = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const queueRaw = await readJsonSafe(queueRes);
    if (!queueRes.ok) {
      logFalApiError(
        { response: { data: queueRaw, status: queueRes.status } },
        { stage: "fal_queue_inpaint", model }
      );
      throw Object.assign(
        new Error(formatFalErrorBody(queueRaw, queueRes.status)),
        { response: { data: queueRaw, status: queueRes.status } }
      );
    }

    const requestId =
      (queueRaw as { request_id?: string })?.request_id ||
      (runRaw as { request_id?: string })?.request_id;
    if (!requestId) {
      throw Object.assign(new Error("Fal inpaint queue missing request_id"), {
        response: { data: queueRaw },
      });
    }

    const statusUrl = `https://queue.fal.run/${model}/requests/${requestId}/status`;
    const resultUrl = `https://queue.fal.run/${model}/requests/${requestId}`;

    while (Date.now() - started < timeoutMs) {
      await sleep(1500);
      const stRes = await fetch(statusUrl, {
        headers: { Authorization: authHeader(key) },
      });
      const st = (await readJsonSafe(stRes)) as FalQueueStatus;
      const status = (st.status || "").toUpperCase();

      if (status === "COMPLETED") {
        const outRes = await fetch(st.response_url || resultUrl, {
          headers: { Authorization: authHeader(key) },
        });
        const outRaw = await readJsonSafe(outRes);
        if (!outRes.ok) {
          throw Object.assign(
            new Error(formatFalErrorBody(outRaw, outRes.status)),
            { response: { data: outRaw, status: outRes.status } }
          );
        }
        const images = extractFalImages(outRaw);
        if (!images.length) {
          throw Object.assign(new Error("Fal inpaint returned no images"), {
            response: { data: outRaw },
          });
        }
        return {
          images,
          prompt: String(body.prompt),
          seed: (outRaw as { seed?: number })?.seed,
          requestId,
          raw: outRaw,
        };
      }

      if (
        status === "FAILED" ||
        status === "CANCELLED" ||
        status === "CANCELED" ||
        status === "ERROR"
      ) {
        throw Object.assign(
          new Error(formatFalErrorBody(st, stRes.status) || `Fal job ${status}`),
          { response: { data: st } }
        );
      }
    }

    throw Object.assign(new Error("Fal inpaint timed out"), {
      response: { data: { message: "timeout", requestId } },
    });
  } catch (error) {
    const alreadyLogged =
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: unknown }).response;
    if (!alreadyLogged) {
      logFalApiError(error, { stage: "unhandled_inpaint", model });
    }
    throw error;
  }
}

/**
 * InstantID (FaceID / IP-Adapter) — face_image_url is mandatory.
 * Pure text-to-image without a face reference is not supported here.
 */
export type FalInstantIdInput = {
  face_image_url: string;
  prompt: string;
  negative_prompt?: string;
  style?: string;
  num_inference_steps?: number;
  guidance_scale?: number;
  ip_adapter_scale?: number;
  identity_controlnet_conditioning_scale?: number;
  controlnet_conditioning_scale?: number;
  enhance_face_region?: boolean;
  enable_lcm?: boolean;
  seed?: number;
};

export async function runFalInstantId(
  input: FalInstantIdInput,
  opts?: { model?: string; timeoutMs?: number }
): Promise<FalKontextResult> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY missing");

  const faceRaw = (input.face_image_url || "").trim();
  if (!faceRaw) {
    throw new Error("face_image_url_required");
  }
  const prompt = (input.prompt || "").trim();
  if (!prompt) {
    throw new Error("prompt_required");
  }

  const model = (
    opts?.model ||
    process.env.FAL_LOOKBOOK_FACE_MODEL?.trim() ||
    FAL_INSTANT_ID
  ).replace(/^\//, "");

  const timeoutMs = opts?.timeoutMs ?? 110_000;
  const started = Date.now();

  let faceUrl = faceRaw;
  try {
    faceUrl = await ensureFalHttpsImageUrl(faceRaw);
  } catch (error) {
    logFalApiError(error, { stage: "instantid_ensure_face" });
    throw error instanceof Error ? error : new Error(String(error));
  }

  const body: Record<string, unknown> = {
    face_image_url: faceUrl,
    prompt,
    // Photoreal lookbook — avoid InstantID stylized presets.
    style: input.style || "(No style)",
    negative_prompt:
      input.negative_prompt ||
      "anime, cartoon, illustration, painting, 3d render, cgi, different person, face morph, identity drift, deformed face, blurry, low quality, watermark, text",
    num_inference_steps:
      typeof input.num_inference_steps === "number"
        ? input.num_inference_steps
        : 28,
    guidance_scale:
      typeof input.guidance_scale === "number" ? input.guidance_scale : 4.5,
    ip_adapter_scale:
      typeof input.ip_adapter_scale === "number" ? input.ip_adapter_scale : 0.85,
    identity_controlnet_conditioning_scale:
      typeof input.identity_controlnet_conditioning_scale === "number"
        ? input.identity_controlnet_conditioning_scale
        : 0.85,
    controlnet_conditioning_scale:
      typeof input.controlnet_conditioning_scale === "number"
        ? input.controlnet_conditioning_scale
        : 0.35,
    enhance_face_region:
      typeof input.enhance_face_region === "boolean"
        ? input.enhance_face_region
        : true,
    // Higher quality without LCM shortcuts.
    enable_lcm:
      typeof input.enable_lcm === "boolean" ? input.enable_lcm : false,
    ...(typeof input.seed === "number" ? { seed: input.seed } : {}),
  };

  console.info("[fal] instantid request", {
    model,
    promptChars: prompt.length,
    promptPreview: prompt.slice(0, 140),
    face: summarizeImageUrl(faceUrl),
    ip_adapter_scale: body.ip_adapter_scale,
  });

  try {
    const runRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const runRaw = await readJsonSafe(runRes);

    if (runRes.ok) {
      const images = extractFalImages(runRaw);
      if (images.length) {
        return {
          images,
          prompt,
          seed: (runRaw as { seed?: number })?.seed,
          raw: runRaw,
        };
      }
    } else if (runRes.status !== 202 && runRes.status !== 409) {
      logFalApiError(
        { response: { data: runRaw, status: runRes.status } },
        { stage: "instantid_fal_run", model }
      );
      if (runRes.status >= 400 && runRes.status < 500 && runRes.status !== 429) {
        throw Object.assign(
          new Error(formatFalErrorBody(runRaw, runRes.status)),
          { response: { data: runRaw, status: runRes.status } }
        );
      }
    }

    const submitted = (runRaw || {}) as {
      request_id?: string;
      status_url?: string;
      response_url?: string;
    };
    let requestId = submitted.request_id;
    let statusUrl = submitted.status_url;
    let resultUrl = submitted.response_url;

    if (!requestId) {
      const qRes = await fetch(`https://queue.fal.run/${model}`, {
        method: "POST",
        headers: {
          Authorization: authHeader(key),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const qRaw = await readJsonSafe(qRes);
      if (!qRes.ok) {
        logFalApiError(
          { response: { data: qRaw, status: qRes.status } },
          { stage: "instantid_queue_submit", model }
        );
        throw Object.assign(
          new Error(formatFalErrorBody(qRaw, qRes.status)),
          { response: { data: qRaw, status: qRes.status } }
        );
      }
      const q = qRaw as {
        request_id?: string;
        status_url?: string;
        response_url?: string;
      };
      requestId = q.request_id;
      statusUrl = q.status_url;
      resultUrl = q.response_url;
    }

    if (!requestId) {
      throw Object.assign(
        new Error("InstantID returned no images and no request_id"),
        { response: { data: runRaw } }
      );
    }

    statusUrl =
      statusUrl ||
      `https://queue.fal.run/${model}/requests/${requestId}/status`;
    resultUrl =
      resultUrl || `https://queue.fal.run/${model}/requests/${requestId}`;

    while (Date.now() - started < timeoutMs) {
      await sleep(1500);
      const stRes = await fetch(`${statusUrl}?logs=1`, {
        headers: { Authorization: authHeader(key) },
        cache: "no-store",
      });
      const st = (await readJsonSafe(stRes)) as {
        status?: string;
        response_url?: string;
      };
      if (!stRes.ok) continue;
      const status = (st.status || "").toUpperCase();
      if (status === "COMPLETED" || status === "OK") {
        const rUrl = st.response_url || resultUrl;
        const rRes = await fetch(rUrl, {
          headers: { Authorization: authHeader(key) },
          cache: "no-store",
        });
        const rRaw = await readJsonSafe(rRes);
        if (!rRes.ok) {
          throw Object.assign(
            new Error(formatFalErrorBody(rRaw, rRes.status)),
            { response: { data: rRaw, status: rRes.status } }
          );
        }
        const images = extractFalImages(rRaw);
        if (!images.length) {
          throw Object.assign(new Error("InstantID completed with no images"), {
            response: { data: rRaw },
          });
        }
        return {
          images,
          prompt,
          seed: (rRaw as { seed?: number })?.seed,
          raw: rRaw,
        };
      }
      if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
        throw Object.assign(new Error(`InstantID ${status}`), {
          response: { data: st },
        });
      }
    }

    throw new Error("InstantID timed out");
  } catch (error) {
    logFalApiError(error, { stage: "instantid_unhandled", model });
    throw error;
  }
}

/**
 * BiRefNet background removal → transparent subject PNG.
 * Auth: FAL_KEY / FAL_API_KEY. Override model with FAL_REMBG_MODEL.
 */
export async function runFalRembg(
  imageUrl: string,
  opts?: { model?: string; timeoutMs?: number; portrait?: boolean }
): Promise<FalKontextResult> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY missing");

  const model = (
    opts?.model ||
    process.env.FAL_REMBG_MODEL?.trim() ||
    FAL_BIREFNET
  ).replace(/^\//, "");

  const timeoutMs = opts?.timeoutMs ?? 90_000;
  const started = Date.now();

  let httpsUrl = imageUrl;
  try {
    httpsUrl = await ensureFalHttpsImageUrl(imageUrl);
  } catch (error) {
    logFalApiError(error, { stage: "rembg_ensure_image" });
    throw error instanceof Error ? error : new Error(String(error));
  }

  const body = {
    image_url: httpsUrl,
    model: opts?.portrait === false ? "General Use (Light)" : "Portrait",
  };

  console.info("[fal] rembg request", {
    model,
    image: httpsUrl.slice(0, 80),
  });

  try {
    const runRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const runRaw = await readJsonSafe(runRes);

    if (runRes.ok) {
      const images = validateFalImages(extractFalImages(runRaw), "rembg");
      if (images.length) {
        return { images, raw: runRaw };
      }
    } else if (runRes.status !== 202 && runRes.status !== 409) {
      logFalApiError(
        { response: { data: runRaw, status: runRes.status } },
        { stage: "fal_run_rembg", model }
      );
      if (runRes.status >= 400 && runRes.status < 500 && runRes.status !== 429) {
        throw Object.assign(
          new Error(formatFalErrorBody(runRaw, runRes.status)),
          { response: { data: runRaw, status: runRes.status } }
        );
      }
    }

    const submitted = (runRaw || {}) as FalQueueSubmit;
    let requestId = submitted.request_id;
    let statusUrl = submitted.status_url;
    let resultUrl = submitted.response_url;

    if (!requestId) {
      const qRes = await fetch(`https://queue.fal.run/${model}`, {
        method: "POST",
        headers: {
          Authorization: authHeader(key),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const qRaw = await readJsonSafe(qRes);
      if (!qRes.ok) {
        throw Object.assign(
          new Error(formatFalErrorBody(qRaw, qRes.status)),
          { response: { data: qRaw, status: qRes.status } }
        );
      }
      const q = qRaw as FalQueueSubmit;
      requestId = q.request_id;
      statusUrl = q.status_url;
      resultUrl = q.response_url;
    }

    if (!requestId) {
      throw Object.assign(new Error("Fal rembg returned no image and no request_id"), {
        response: { data: runRaw },
      });
    }

    statusUrl =
      statusUrl ||
      `https://queue.fal.run/${model}/requests/${requestId}/status`;
    resultUrl =
      resultUrl || `https://queue.fal.run/${model}/requests/${requestId}`;

    while (Date.now() - started < timeoutMs) {
      await sleep(1200);
      const stRes = await fetch(`${statusUrl}?logs=1`, {
        headers: { Authorization: authHeader(key) },
        cache: "no-store",
      });
      const st = (await readJsonSafe(stRes)) as FalQueueStatus;
      if (!stRes.ok) continue;

      const status = (st.status || "").toUpperCase();
      if (status === "COMPLETED" || status === "OK") {
        const outRes = await fetch(resultUrl, {
          headers: { Authorization: authHeader(key) },
          cache: "no-store",
        });
        const outRaw = await readJsonSafe(outRes);
        if (!outRes.ok) {
          throw Object.assign(
            new Error(formatFalErrorBody(outRaw, outRes.status)),
            { response: { data: outRaw, status: outRes.status } }
          );
        }
        const images = validateFalImages(extractFalImages(outRaw), "rembg");
        if (!images.length) {
          throw Object.assign(new Error("Fal rembg completed but returned no image"), {
            response: { data: outRaw },
          });
        }
        return { images, requestId, raw: outRaw };
      }

      if (
        status === "FAILED" ||
        status === "CANCELLED" ||
        status === "CANCELED" ||
        status === "ERROR"
      ) {
        throw Object.assign(
          new Error(formatFalErrorBody(st, stRes.status) || `Fal rembg ${status}`),
          { response: { data: st } }
        );
      }
    }

    throw Object.assign(new Error("Fal rembg timed out"), {
      response: { data: { message: "timeout", requestId } },
    });
  } catch (error) {
    logFalApiError(error, { stage: "unhandled_rembg", model });
    throw error;
  }
}

function extractFalImages(raw: unknown): FalImage[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  // Official: { images: [{ url }] }. Also accept nested data / file / output.
  const nested =
    obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>)
      : null;
  const list =
    obj.images ??
    obj.image ??
    obj.output ??
    nested?.images ??
    nested?.image ??
    obj.file;
  if (typeof list === "string" && /^https?:\/\//i.test(list)) {
    return [{ url: list }];
  }
  if (!Array.isArray(list)) {
    if (list && typeof list === "object" && "url" in (list as object)) {
      const u = (list as FalImage).url;
      return u && /^https?:\/\//i.test(u) ? [{ url: u }] : [];
    }
    return [];
  }
  return list
    .map((item) => {
      if (typeof item === "string" && /^https?:\/\//i.test(item)) {
        return { url: item };
      }
      if (item && typeof item === "object") {
        const img = item as FalImage & { file_data?: string; file_name?: string };
        const url = img.url;
        if (url && /^https?:\/\//i.test(url)) {
          return { url, width: img.width, height: img.height };
        }
      }
      return null;
    })
    .filter((x): x is FalImage => Boolean(x?.url));
}
