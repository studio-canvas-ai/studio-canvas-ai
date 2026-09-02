/**
 * Client → POST /api/shorts/extract-hooks
 */

import type { ShortsHookFrame } from "@/lib/shortsHookShared";
import {
  captureHookFramesFromVideoElement,
  captureHookFramesFromVideoUrl,
} from "@/lib/shortsCaptureFrames";
import type { ShortsVideoAsset } from "@/lib/shortsVideo";

export type ExtractHooksResult = {
  hooks: ShortsHookFrame[];
  method: "ffmpeg" | "client_frames";
};

async function postJsonExtract(
  videoId: string,
  key: string | null
): Promise<
  | { ok: true; hooks: ShortsHookFrame[]; method: "ffmpeg" | "client_frames" }
  | { ok: false; preferClient?: boolean; error: string }
> {
  const res = await fetch("/api/shorts/extract-hooks", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoId,
      key: key || undefined,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    hooks?: ShortsHookFrame[];
    method?: "ffmpeg" | "client_frames";
    preferClient?: boolean;
    error?: string;
  };
  if (res.ok && json.ok && json.hooks?.length) {
    return {
      ok: true,
      hooks: json.hooks,
      method: json.method || "ffmpeg",
    };
  }
  return {
    ok: false,
    preferClient: json.preferClient || res.status === 422 || res.status === 413,
    error: json.error || `extract_http_${res.status}`,
  };
}

async function postClientFrames(
  asset: ShortsVideoAsset,
  frames: Array<{ blob: Blob; timestampSec: number }>
): Promise<ExtractHooksResult> {
  const fd = new FormData();
  fd.append("videoId", asset.videoId);
  if (asset.storageKey) fd.append("key", asset.storageKey);
  fd.append(
    "timestamps",
    JSON.stringify(frames.map((f) => f.timestampSec))
  );
  frames.forEach((f, i) => {
    fd.append("frame", f.blob, `hook-${i}.jpg`);
  });

  const res = await fetch("/api/shorts/extract-hooks", {
    method: "POST",
    credentials: "same-origin",
    body: fd,
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    hooks?: ShortsHookFrame[];
    method?: "ffmpeg" | "client_frames";
    error?: string;
  };
  if (!res.ok || !json.ok || !json.hooks?.length) {
    throw new Error(json.error || `extract_http_${res.status}`);
  }
  return {
    hooks: json.hooks,
    method: json.method || "client_frames",
  };
}

/**
 * Prefer local canvas on the mounted preview; cloud FFmpeg only when no local file.
 */
export async function extractShortsHookFrames(
  asset: ShortsVideoAsset,
  opts?: { previewVideo?: HTMLVideoElement | null }
): Promise<ExtractHooksResult> {
  const previewVideo = opts?.previewVideo;
  const hasLocalPreview =
    (previewVideo?.videoWidth && previewVideo.videoHeight) ||
    asset.previewUrl.startsWith("blob:");

  if (hasLocalPreview) {
    const captured =
      previewVideo?.videoWidth && previewVideo.videoHeight
        ? await captureHookFramesFromVideoElement(previewVideo)
        : await captureHookFramesFromVideoUrl(asset.previewUrl);
    try {
      return await postClientFrames(asset, captured);
    } catch (err) {
      console.warn("[shorts/extract] server score failed, using local hooks", err);
      return {
        hooks: captured.map((f, i) => ({
          id: `hook_local_${i}_${Date.now().toString(36)}`,
          index: i,
          timestampSec: f.timestampSec,
          score: Math.max(0.2, 1 - i * 0.08),
          imageUrl: URL.createObjectURL(f.blob),
          storageKey: null,
        })),
        method: "client_frames",
      };
    }
  }

  if (asset.storage === "r2" && asset.storageKey) {
    const server = await postJsonExtract(asset.videoId, asset.storageKey);
    if (server.ok) return { hooks: server.hooks, method: server.method };
    if (!server.preferClient) {
      throw new Error(server.error);
    }
  }

  const captured = await captureHookFramesFromVideoUrl(asset.previewUrl);
  return postClientFrames(asset, captured);
}
