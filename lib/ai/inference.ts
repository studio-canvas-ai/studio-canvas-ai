import type { FaceConsistencyPayload } from "@/lib/faceConsistency";

export type InferenceResult = {
  provider: "replicate" | "runpod" | "comfyui" | "mock";
  status: "succeeded" | "processing" | "failed";
  imageUrls: string[];
  jobId?: string;
  message?: string;
  raw?: unknown;
};

function buildPrompt(payload: FaceConsistencyPayload) {
  const styles = payload.styleIds.join(", ");
  return [
    payload.prompt || "professional portrait photograph",
    styles ? `style: ${styles}` : "",
    "preserve exact facial identity, same eyes nose mouth jawline",
    "high detail face, photorealistic",
  ]
    .filter(Boolean)
    .join(". ");
}

/** Replicate InstantID / IP-Adapter FaceID style models */
async function runReplicate(payload: FaceConsistencyPayload): Promise<InferenceResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  const model =
    process.env.REPLICATE_FACE_MODEL ||
    "tencentarc/gfpgan:9283608cc6b7be6b65a8e44983db012355fde4132009bf99d976b2f0896856a3";
  if (!token) throw new Error("REPLICATE_API_TOKEN missing");

  const selfie = payload.selfieUrls[0];
  const body = {
    input: {
      image: selfie,
      prompt: buildPrompt(payload),
      face_weight: payload.faceId.faceWeight,
      ip_adapter_scale: payload.ipAdapter.scale,
      ip_adapter_faceid_weight: payload.ipAdapter.faceIdWeight,
      controlnet_conditioning_scale: payload.controlNet.conditioningScale,
      reference_image: payload.draftUrl ?? selfie,
      dual_reference: Boolean(payload.dualReference),
      selfie_weight: payload.dualReference?.selfieWeight ?? 1,
      draft_weight: payload.dualReference?.draftWeight ?? 0,
      negative_prompt:
        "different person, face change, deformed face, identity drift, low quality",
      aspect_ratio: payload.aspectRatio,
    },
  };

  // Prefer model versions as owner/name:hash; fall back to predictions with version
  const [ownerName, version] = model.includes(":")
    ? model.split(":")
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
    body: JSON.stringify(version ? { version, ...body } : body),
  });

  const data = (await res.json()) as {
    id?: string;
    status?: string;
    output?: string | string[];
    error?: string;
  };
  if (!res.ok) {
    return {
      provider: "replicate",
      status: "failed",
      imageUrls: [],
      message: data.error || `Replicate HTTP ${res.status}`,
      raw: data,
    };
  }

  const output = data.output;
  const urls = Array.isArray(output) ? output : output ? [output] : [];
  return {
    provider: "replicate",
    status: data.status === "succeeded" || urls.length ? "succeeded" : "processing",
    imageUrls: urls,
    jobId: data.id,
    raw: data,
  };
}

async function runRunPod(payload: FaceConsistencyPayload): Promise<InferenceResult> {
  const endpoint = process.env.RUNPOD_ENDPOINT_URL;
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!endpoint || !apiKey) throw new Error("RUNPOD_ENDPOINT_URL / RUNPOD_API_KEY missing");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        ...payload,
        prompt: buildPrompt(payload),
      },
    }),
  });
  const data = (await res.json()) as {
    id?: string;
    status?: string;
    output?: { imageUrls?: string[]; images?: string[] };
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
  const urls = data.output?.imageUrls ?? data.output?.images ?? [];
  return {
    provider: "runpod",
    status: urls.length ? "succeeded" : "processing",
    imageUrls: urls,
    jobId: data.id,
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
      workflow = JSON.parse(readFileSync(workflowPath, "utf8")) as Record<string, unknown>;
      // Inject face weight into common InstantID / IP-Adapter nodes if present
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
  if (!res.ok) {
    return {
      provider: "comfyui",
      status: "failed",
      imageUrls: [],
      message: data.error || `ComfyUI HTTP ${res.status}`,
      raw: data,
    };
  }
  return {
    provider: "comfyui",
    status: "processing",
    imageUrls: [],
    jobId: data.prompt_id,
    message: "ComfyUI job queued — poll /history for images",
    raw: data,
  };
}

export function resolveInferenceProvider():
  | "replicate"
  | "runpod"
  | "comfyui"
  | "mock" {
  const forced = process.env.AI_PROVIDER as
    | "replicate"
    | "runpod"
    | "comfyui"
    | "mock"
    | undefined;
  if (forced) return forced;
  if (process.env.REPLICATE_API_TOKEN) return "replicate";
  if (process.env.RUNPOD_API_KEY && process.env.RUNPOD_ENDPOINT_URL) return "runpod";
  if (process.env.COMFYUI_API_URL) return "comfyui";
  return "mock";
}

/**
 * Run face-consistency portrait inference.
 * Applies InsightFace / IP-Adapter / ControlNet weights from payload (#105–#106).
 */
export async function runFaceConsistentInference(
  payload: FaceConsistencyPayload
): Promise<InferenceResult> {
  const provider = resolveInferenceProvider();
  try {
    if (provider === "replicate") return await runReplicate(payload);
    if (provider === "runpod") return await runRunPod(payload);
    if (provider === "comfyui") return await runComfyUi(payload);
  } catch (err) {
    return {
      provider,
      status: "failed",
      imageUrls: [],
      message: err instanceof Error ? err.message : "inference error",
    };
  }

  return {
    provider: "mock",
    status: "succeeded",
    imageUrls: [],
    message:
      "No GPU provider configured (set REPLICATE_API_TOKEN, RUNPOD_*, or COMFYUI_API_URL). Client may use mock preview.",
  };
}
