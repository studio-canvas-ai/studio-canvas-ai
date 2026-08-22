/**
 * Client → POST /api/shorts/extract-hooks
 */

import type { ShortsHookFrame } from "@/lib/shortsHookShared";
import { captureHookFramesFromVideoUrl } from "@/lib/shortsCaptureFrames";
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
 * Prefer server FFmpeg from R2; fall back to canvas sampling + multipart upload.
 */
export async function extractShortsHookFrames(
  asset: ShortsVideoAsset
): Promise<ExtractHooksResult> {
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
