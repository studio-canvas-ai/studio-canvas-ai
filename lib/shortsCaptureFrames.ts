/**
 * Browser-side lightweight frame sampling from a <video> / object URL.
 * Used when server FFmpeg cannot run (local preview, large clip, cold binary).
 */

import { buildHookTimestamps, SHORTS_HOOK_SAMPLE_COUNT } from "@/lib/shortsHookShared";

export type CapturedHookFrame = {
  blob: Blob;
  timestampSec: number;
};

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    if (!url.startsWith("blob:")) {
      video.crossOrigin = "anonymous";
    }
    const onError = () => {
      cleanup();
      reject(new Error("video_load_failed"));
    };
    const onMeta = () => {
      cleanup();
      resolve(video);
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("error", onError);
    video.src = url;
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("seek_failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = Math.min(
        Math.max(0, time),
        Math.max(0, (video.duration || 1) - 0.05)
      );
    } catch (err) {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(err);
    }
  });
}

function canvasFrame(video: HTMLVideoElement): Promise<Blob> {
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 1280;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas_unavailable"));
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("toBlob_failed"));
        else resolve(blob);
      },
      "image/jpeg",
      0.88
    );
  });
}

/** Capture the currently displayed frame from a live <video> element. */
export async function captureCurrentVideoFrame(
  video: HTMLVideoElement
): Promise<CapturedHookFrame> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("video_not_ready");
  }
  const timestampSec = Number.isFinite(video.currentTime)
    ? Math.round(video.currentTime * 100) / 100
    : 0;
  // Pause so the painted frame is stable (user can resume afterward).
  const wasPlaying = !video.paused && !video.ended;
  if (wasPlaying) {
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  }
  await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  const blob = await canvasFrame(video);
  return { blob, timestampSec };
}

/** Capture evenly spaced stills from an already-mounted preview <video>. */
export async function captureHookFramesFromVideoElement(
  video: HTMLVideoElement,
  count = SHORTS_HOOK_SAMPLE_COUNT
): Promise<CapturedHookFrame[]> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("video_not_ready");
  }

  const duration =
    Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 8;
  const stamps = buildHookTimestamps(duration, count);
  const wasPlaying = !video.paused && !video.ended;
  if (wasPlaying) {
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  }

  const out: CapturedHookFrame[] = [];
  for (const t of stamps) {
    try {
      await seekTo(video, t);
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const blob = await canvasFrame(video);
      out.push({ blob, timestampSec: t });
    } catch (err) {
      console.warn("[shorts] capture skip", t, err);
    }
  }

  if (out.length < 3) {
    throw new Error("capture_too_few_frames");
  }
  return out;
}

/** Fast first-frame poster from a local blob URL (works when codec is browser-decodable). */
export async function captureQuickPosterFromBlob(
  previewUrl: string,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<string | null> {
  const timeoutMs = opts?.timeoutMs ?? 2800;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const onAbort = () => ac.abort();
  opts?.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const video = await loadVideo(previewUrl);
    if (ac.signal.aborted) return null;
    await seekTo(video, 0.25);
    if (ac.signal.aborted) return null;
    const blob = await canvasFrame(video);
    return await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => reject(reader.error ?? new Error("poster_read_failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener("abort", onAbort);
    videoCleanup(previewUrl);
  }
}

function videoCleanup(_previewUrl: string) {
  /* loadVideo creates detached elements — GC handles them */
}

/** Capture evenly spaced stills from a local/object URL video. */
export async function captureHookFramesFromVideoUrl(
  previewUrl: string,
  count = SHORTS_HOOK_SAMPLE_COUNT
): Promise<CapturedHookFrame[]> {
  const video = await loadVideo(previewUrl);
  try {
    return await captureHookFramesFromVideoElement(video, count);
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
