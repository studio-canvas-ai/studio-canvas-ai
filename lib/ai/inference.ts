/**
 * Face-consistent portrait inference.
 *
 * Provider switch (env only — no code change needed when wiring RTX 4090 / RunPod):
 *   1. AI_PROVIDER=fal|replicate|runpod|comfyui|mock  (optional force)
 *   2. Else auto-detect: FAL_KEY → REPLICATE_API_TOKEN → RUNPOD → COMFYUI
 *   3. Else mock A/B drafts so the 4-step widget remains testable without GPU.
 *
 * Concept Gallery styles map via lib/ai/stylePrompts.ts → Fal Flux Kontext Pro
 * (`fal-ai/flux-pro/kontext`) when FAL_KEY is set.
 *
 * RunPod workers receive the full FaceConsistencyPayload under `input` so
 * InstantID / IP-Adapter / ControlNet knobs are never dropped.
 */
import type { FaceConsistencyPayload } from "@/lib/faceConsistency";
import { HERO_AFTER_IMAGE, HERO_BEFORE_IMAGE, CONCEPT_POSE_HINTS } from "@/lib/data";
import {
  hasFalCredentials,
  logFalApiError,
  mapAspectRatioToFal,
  runFalFluxKontextPro,
} from "@/lib/ai/fal";
import { buildPortraitFusionPrompt } from "@/lib/ai/fusionPrompt";

export type InferenceProvider =
  | "fal"
  | "replicate"
  | "runpod"
  | "comfyui"
  | "mock";

export type InferenceResult = {
  provider: InferenceProvider;
  status: "succeeded" | "processing" | "failed";
  imageUrls: string[];
  jobId?: string;
  message?: string;
  raw?: unknown;
};

function buildPrompt(payload: FaceConsistencyPayload) {
  const styleId = payload.styleIds?.[0];
  const poseHint = styleId ? CONCEPT_POSE_HINTS[styleId] : undefined;

  // Full fusion prompt already assembled client-side for initial/train/regenerate-fusion.
  if (
    payload.prompt.includes("Fully re-render") ||
    payload.prompt.includes("FUSION") ||
    payload.fusionMode === "full_rerender"
  ) {
    return payload.prompt.trim();
  }

  return buildPortraitFusionPrompt({
    styleIds: payload.styleIds,
    userPrompt: payload.prompt,
    backgroundScene: payload.backgroundScene,
    poseHint,
  });
}

function normalizeOutputUrls(output: unknown): string[] {
  if (!output) return [];
  if (typeof output === "string") {
    return output.startsWith("http") || output.startsWith("data:") ? [output] : [];
  }
  if (Array.isArray(output)) {
    return output.flatMap((item) => normalizeOutputUrls(item));
  }
  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;
    for (const key of ["imageUrls", "images", "image", "url", "output"]) {
      if (key in obj) {
        const found = normalizeOutputUrls(obj[key]);
        if (found.length) return found;
      }
    }
  }
  return [];
}

function aspectToSize(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "1:1":
      return { width: 1024, height: 1024 };
    case "4:3":
      return { width: 1024, height: 768 };
    case "3:4":
      return { width: 768, height: 1024 };
    case "16:9":
      return { width: 1280, height: 720 };
    case "id":
    case "3.5:4.5":
      return { width: 768, height: 988 };
    case "9:16":
    default:
      return { width: 768, height: 1280 };
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "https://www.studio-canvas-ai.com"
  ).replace(/\/$/, "");
}

function toAbsolutePublicUrl(path: string): string {
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

type ReplicatePrediction = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: string;
  urls?: { get?: string };
};

async function pollReplicatePrediction(
  token: string,
  prediction: ReplicatePrediction,
  maxAttempts = 60
): Promise<ReplicatePrediction> {
  let current = prediction;
  const getUrl =
    current.urls?.get ||
    (current.id
      ? `https://api.replicate.com/v1/predictions/${current.id}`
      : null);
  if (!getUrl) return current;

  for (let i = 0; i < maxAttempts; i++) {
    const status = (current.status || "").toLowerCase();
    if (status === "succeeded" || status === "failed" || status === "canceled") {
      return current;
    }
    await sleep(1500);
    const res = await fetch(getUrl, {
      headers: { Authorization: `Token ${token}` },
      cache: "no-store",
    });
    current = (await res.json()) as ReplicatePrediction;
    if (!res.ok) {
      return {
        ...current,
        status: "failed",
        error: current.error || `Replicate poll HTTP ${res.status}`,
      };
    }
  }
  return {
    ...current,
    status: "failed",
    error: current.error || "Replicate prediction timed out",
  };
}

/** Fal.ai FLUX.1 Kontext [pro] — style pack + face reference image */
async function runFal(payload: FaceConsistencyPayload): Promise<InferenceResult> {
  if (!hasFalCredentials()) throw new Error("FAL_KEY missing");

  const selfie = payload.selfieUrls[0];
  if (!selfie) throw new Error("selfie_image_required");

  // Initial/train: selfie Kontext base. Regenerate dual-ref: draft anchors composition;
  // selfieUrls stay in payload for identity stack / alternate providers.
  const useSelfieBase = payload.mode !== "regenerate" || !payload.draftUrl;

  const imageUrl = useSelfieBase ? selfie : payload.draftUrl!;

  const prompt = buildPrompt(payload);
  // Docs default is 1; request 2 for A/B compare when initial/train.
  const numImages = payload.mode === "regenerate" ? 1 : 2;

  console.info("[inference/fal] dual-reference mapping", {
    mode: payload.mode,
    fusionMode: payload.fusionMode,
    imageBase: useSelfieBase ? "selfie" : "draft",
    selfieCount: payload.selfieUrls.length,
    hasDraft: Boolean(payload.draftUrl),
  });

  try {
    const isBgFusion =
      payload.mode === "regenerate" &&
      payload.fusionMode === "full_rerender" &&
      Boolean(payload.backgroundScene?.trim());

    const result = await runFalFluxKontextPro({
      prompt,
      image_url: imageUrl,
      num_images: numImages,
      aspect_ratio: mapAspectRatioToFal(payload.aspectRatio),
      guidance_scale: isBgFusion ? 4.5 : payload.fusionMode === "full_rerender" ? 4.0 : 3.5,
      output_format: "jpeg",
      safety_tolerance: "2",
      enhance_prompt: false,
    });

    const urls = result.images.map((img) => img.url).filter(Boolean);
    return {
      provider: "fal",
      status: urls.length ? "succeeded" : "failed",
      imageUrls: urls,
      jobId: result.requestId,
      message: urls.length ? undefined : "Fal returned no images",
      raw: result.raw,
    };
  } catch (error) {
    logFalApiError(
      (error as { response?: { data?: unknown } })?.response
        ? error
        : { response: { data: error instanceof Error ? error.message : error } },
      {
        stage: "runFal",
        mode: payload.mode,
        styleIds: payload.styleIds,
        aspectRatio: payload.aspectRatio,
      }
    );
    return {
      provider: "fal",
      status: "failed",
      imageUrls: [],
      message: error instanceof Error ? error.message : "Fal inference error",
      raw:
        error && typeof error === "object" && "response" in error
          ? (error as { response?: unknown }).response
          : undefined,
    };
  }
}

/** Replicate InstantID / IP-Adapter FaceID style models */
async function runReplicate(payload: FaceConsistencyPayload): Promise<InferenceResult> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  const model =
    process.env.REPLICATE_FACE_MODEL?.trim() || "zsxkib/instant-id";
  if (!token) throw new Error("REPLICATE_API_TOKEN missing");

  const selfie = payload.selfieUrls[0];
  if (!selfie) throw new Error("selfie_image_required");

  const { width, height } = aspectToSize(payload.aspectRatio);
  const prompt = buildPrompt(payload);

  const input: Record<string, unknown> = {
    image: selfie,
    prompt,
    negative_prompt:
      "different person, face change, deformed face, identity drift, low quality, blurry",
    width,
    height,
    ip_adapter_scale: payload.ipAdapter.scale,
    controlnet_conditioning_scale: payload.controlNet.conditioningScale,
    face_strength: payload.faceId.faceWeight,
    guidance_scale: 5,
    num_outputs: 2,
  };

  if (payload.draftUrl) {
    input.reference_image = payload.draftUrl;
  }

  const [ownerName, version] = model.includes(":")
    ? (model.split(":") as [string, string])
    : [model, null];
  const url = version
    ? "https://api.replicate.com/v1/predictions"
    : `https://api.replicate.com/v1/models/${ownerName}/predictions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify(version ? { version, input } : { input }),
  });

  let data = (await res.json()) as ReplicatePrediction;
  if (!res.ok) {
    return {
      provider: "replicate",
      status: "failed",
      imageUrls: [],
      message: data.error || `Replicate HTTP ${res.status}`,
      raw: data,
    };
  }

  data = await pollReplicatePrediction(token, data);

  const urls = normalizeOutputUrls(data.output);
  const status = (data.status || "").toLowerCase();
  if (status === "failed" || status === "canceled") {
    return {
      provider: "replicate",
      status: "failed",
      imageUrls: [],
      jobId: data.id,
      message: data.error || "Replicate prediction failed",
      raw: data,
    };
  }

  return {
    provider: "replicate",
    status: urls.length ? "succeeded" : "failed",
    imageUrls: urls,
    jobId: data.id,
    message: urls.length ? undefined : "Replicate returned no images",
    raw: data,
  };
}

/**
 * RunPod serverless / dedicated RTX 4090 endpoint.
 * Env: RUNPOD_API_KEY + RUNPOD_ENDPOINT_URL (…/run or …/runsync).
 * Full face-consistency stack is forwarded under `input`.
 */
async function runRunPod(payload: FaceConsistencyPayload): Promise<InferenceResult> {
  const endpoint = process.env.RUNPOD_ENDPOINT_URL?.trim();
  const apiKey = process.env.RUNPOD_API_KEY?.trim();
  if (!endpoint || !apiKey) {
    throw new Error("RUNPOD_ENDPOINT_URL / RUNPOD_API_KEY missing");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        mode: payload.mode,
        prompt: buildPrompt(payload),
        selfieUrls: payload.selfieUrls,
        draftUrl: payload.draftUrl ?? null,
        aspectRatio: payload.aspectRatio,
        styleIds: payload.styleIds,
        // Face-consistency stack — keep in sync with FaceConsistencyPayload
        faceId: payload.faceId,
        ipAdapter: payload.ipAdapter,
        controlNet: payload.controlNet,
        dualReference: payload.dualReference,
        identityLock: payload.identityLock,
        creditCost: payload.creditCost,
      },
    }),
  });

  const data = (await res.json()) as {
    id?: string;
    status?: string;
    output?: unknown;
    error?: string;
  };

  if (!res.ok) {
    return {
      provider: "runpod",
      status: "failed",
      imageUrls: [],
      message: data.error || `RunPod HTTP ${res.status}`,
      raw: data,
    };
  }

  let urls = normalizeOutputUrls(data.output);
  let status = (data.status || "").toLowerCase();

  if (
    !urls.length &&
    data.id &&
    (status === "in_queue" || status === "in_progress" || status === "processing")
  ) {
    const statusUrl = endpoint.includes("/run")
      ? endpoint.replace(/\/run(?:sync)?\/?$/, `/status/${data.id}`)
      : null;
    if (statusUrl) {
      for (let i = 0; i < 40; i++) {
        await sleep(1500);
        const poll = await fetch(statusUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
        });
        const polled = (await poll.json()) as typeof data;
        status = (polled.status || "").toLowerCase();
        urls = normalizeOutputUrls(polled.output);
        if (urls.length || status === "completed" || status === "failed") {
          if (status === "failed") {
            return {
              provider: "runpod",
              status: "failed",
              imageUrls: [],
              jobId: data.id,
              message: polled.error || "RunPod job failed",
              raw: polled,
            };
          }
          break;
        }
      }
    }
  }

  return {
    provider: "runpod",
    status: urls.length ? "succeeded" : "failed",
    imageUrls: urls,
    jobId: data.id,
    message: urls.length ? undefined : data.error || "RunPod returned no images",
    raw: data,
  };
}

async function runComfyUi(payload: FaceConsistencyPayload): Promise<InferenceResult> {
  const base = process.env.COMFYUI_API_URL?.replace(/\/$/, "");
  if (!base) throw new Error("COMFYUI_API_URL missing");

  const workflowPath = process.env.COMFYUI_WORKFLOW_PATH;
  let workflow: Record<string, unknown> = {
    prompt: buildPrompt(payload),
    face_consistency: payload,
  };
  if (workflowPath) {
    try {
      const { readFileSync } = await import("fs");
      workflow = JSON.parse(readFileSync(workflowPath, "utf8")) as Record<
        string,
        unknown
      >;
      workflow.__face_payload = payload;
    } catch {
      /* use inline workflow shell */
    }
  }

  const res = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });
  const data = (await res.json()) as { prompt_id?: string; error?: string };
  if (!res.ok || !data.prompt_id) {
    return {
      provider: "comfyui",
      status: "failed",
      imageUrls: [],
      message: data.error || `ComfyUI HTTP ${res.status}`,
      raw: data,
    };
  }

  const promptId = data.prompt_id;
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const histRes = await fetch(`${base}/history/${promptId}`, {
      cache: "no-store",
    });
    if (!histRes.ok) continue;
    const hist = (await histRes.json()) as Record<
      string,
      {
        outputs?: Record<
          string,
          { images?: Array<{ filename: string; subfolder?: string; type?: string }> }
        >;
        status?: { completed?: boolean; status_str?: string };
      }
    >;
    const entry = hist[promptId];
    if (!entry) continue;

    const urls: string[] = [];
    for (const node of Object.values(entry.outputs || {})) {
      for (const img of node.images || []) {
        const params = new URLSearchParams({
          filename: img.filename,
          subfolder: img.subfolder || "",
          type: img.type || "output",
        });
        urls.push(`${base}/view?${params.toString()}`);
      }
    }
    if (urls.length) {
      return {
        provider: "comfyui",
        status: "succeeded",
        imageUrls: urls,
        jobId: promptId,
        raw: entry,
      };
    }
    if (entry.status?.status_str === "error") {
      return {
        provider: "comfyui",
        status: "failed",
        imageUrls: [],
        jobId: promptId,
        message: "ComfyUI workflow error",
        raw: entry,
      };
    }
  }

  return {
    provider: "comfyui",
    status: "failed",
    imageUrls: [],
    jobId: promptId,
    message: "ComfyUI job timed out waiting for images",
  };
}

/**
 * Soft demo drafts (시안 A / 시안 B) for environments without GPU credentials.
 * Prefer uploaded selfies so compare → detail → download still feels real.
 */
async function runMock(payload: FaceConsistencyPayload): Promise<InferenceResult> {
  // Brief delay so training overlay / progress bar remains visible in UI tests.
  await sleep(600);

  const selfies = (payload.selfieUrls || []).filter(
    (u) => typeof u === "string" && u.length > 0 && !u.startsWith("blob:")
  );

  if (payload.mode === "regenerate") {
    const pool = [
      ...selfies,
      toAbsolutePublicUrl(HERO_AFTER_IMAGE),
      toAbsolutePublicUrl(HERO_BEFORE_IMAGE),
    ].filter((u): u is string => Boolean(u));
    const current = payload.draftUrl || "";
    const next = pool.find((u) => u !== current) || pool[0] || current;
    return {
      provider: "mock",
      status: "succeeded",
      imageUrls: [next],
      jobId: `mock-regen-${Date.now()}`,
      message: "mock_demo_regenerate",
      raw: {
        mock: true,
        mode: payload.mode,
        prompt: payload.prompt,
        styleIds: payload.styleIds,
        identityLock: payload.identityLock,
      },
    };
  }

  const draftA = selfies[0] || toAbsolutePublicUrl(HERO_AFTER_IMAGE);
  const draftB =
    selfies[1] ||
    selfies[0] ||
    toAbsolutePublicUrl(HERO_BEFORE_IMAGE) ||
    draftA;

  return {
    provider: "mock",
    status: "succeeded",
    imageUrls: [draftA, draftB],
    jobId: `mock-${Date.now()}`,
    message: "mock_demo_drafts",
    raw: {
      mock: true,
      mode: payload.mode,
      styleIds: payload.styleIds,
      identityLock: payload.identityLock,
    },
  };
}

function resolveForcedProvider(): InferenceProvider | null {
  const forced = process.env.AI_PROVIDER?.trim() as
    | InferenceProvider
    | ""
    | undefined;
  if (
    forced === "fal" ||
    forced === "replicate" ||
    forced === "runpod" ||
    forced === "comfyui" ||
    forced === "mock"
  ) {
    return forced;
  }
  return null;
}

function hasReplicateCreds() {
  return Boolean(process.env.REPLICATE_API_TOKEN?.trim());
}

function hasRunPodCreds() {
  return Boolean(
    process.env.RUNPOD_API_KEY?.trim() && process.env.RUNPOD_ENDPOINT_URL?.trim()
  );
}

function hasComfyCreds() {
  return Boolean(process.env.COMFYUI_API_URL?.trim());
}

/** Prefer Fal Kontext Pro (concept gallery), then other GPU providers; else mock. */
export function resolveInferenceProvider(): InferenceProvider {
  const forced = resolveForcedProvider();
  if (forced === "mock") return "mock";
  if (forced === "fal" && hasFalCredentials()) return "fal";
  if (forced === "replicate" && hasReplicateCreds()) return "replicate";
  if (forced === "runpod" && hasRunPodCreds()) return "runpod";
  if (forced === "comfyui" && hasComfyCreds()) return "comfyui";

  if (!forced) {
    if (hasFalCredentials()) return "fal";
    if (hasReplicateCreds()) return "replicate";
    if (hasRunPodCreds()) return "runpod";
    if (hasComfyCreds()) return "comfyui";
    return "mock";
  }

  // Forced real provider without credentials → still mock so the app does not 502.
  return "mock";
}

/**
 * Returns a hard config error only when a real provider is forced but incomplete.
 * Soft/auto mock paths return null so /api/generate can continue with demo drafts.
 */
export function describeAiProviderConfigError(): string | null {
  const forced = resolveForcedProvider();
  if (!forced || forced === "mock") return null;

  if (forced === "fal" && !hasFalCredentials()) {
    return "FAL_KEY is not configured. Set the Fal.ai key or unset AI_PROVIDER to use mock drafts.";
  }
  if (forced === "replicate" && !hasReplicateCreds()) {
    return "REPLICATE_API_TOKEN is not configured. Set the token or unset AI_PROVIDER to use mock drafts.";
  }
  if (forced === "runpod") {
    const missing: string[] = [];
    if (!process.env.RUNPOD_API_KEY?.trim()) missing.push("RUNPOD_API_KEY");
    if (!process.env.RUNPOD_ENDPOINT_URL?.trim()) missing.push("RUNPOD_ENDPOINT_URL");
    if (missing.length) {
      return `${missing.join(" and ")} missing. Configure RunPod or unset AI_PROVIDER for mock drafts.`;
    }
  }
  if (forced === "comfyui" && !hasComfyCreds()) {
    return "COMFYUI_API_URL is not configured. Set the URL or unset AI_PROVIDER to use mock drafts.";
  }
  return null;
}

/**
 * Run face-consistency portrait inference.
 * Real GPU when configured; otherwise succeeds with mock A/B drafts.
 */
export async function runFaceConsistentInference(
  payload: FaceConsistencyPayload
): Promise<InferenceResult> {
  const provider = resolveInferenceProvider();

  // Forced provider missing creds → soft mock (never throw / 502 the widget).
  if (provider === "mock") {
    return runMock(payload);
  }

  try {
    if (provider === "fal") return await runFal(payload);
    if (provider === "replicate") return await runReplicate(payload);
    if (provider === "runpod") return await runRunPod(payload);
    if (provider === "comfyui") return await runComfyUi(payload);
  } catch (error) {
    console.error("AI API Error:", error);
    // Soft fallback: keep the wizard flow alive when the remote GPU blips.
    const allowSoftMock =
      process.env.ALLOW_INFERENCE_SOFT_MOCK !== "false" &&
      resolveForcedProvider() !== provider;
    if (allowSoftMock || !resolveForcedProvider()) {
      console.warn("[inference] falling back to mock drafts after provider error");
      return runMock(payload);
    }
    return {
      provider,
      status: "failed",
      imageUrls: [],
      message: error instanceof Error ? error.message : "inference error",
    };
  }

  return runMock(payload);
}
