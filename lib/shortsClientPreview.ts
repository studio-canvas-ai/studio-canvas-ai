"use client";

/**
 * Client-side HEVC → H.264 preview (FFmpeg.wasm).
 * Samsung / iPhone gallery clips play in <video> on PC but not mobile Chrome —
 * transcode locally so users never touch camera settings (YouTube-style).
 */

import { fetchFile } from "@ffmpeg/util";
import { getFfmpeg, type ShortsMixProgress } from "@/lib/shortsFfmpegMix";

export type ClientPreviewProgress = {
  phase: "loading_engine" | "poster" | "transcode" | "done";
  ratio: number;
};

export type ClientPreviewResult = {
  posterUrl: string | null;
  playableUrl: string | null;
};

async function safeDelete(
  ffmpeg: Awaited<ReturnType<typeof getFfmpeg>>,
  name: string
) {
  try {
    await ffmpeg.deleteFile(name);
  } catch {
    /* ignore */
  }
}

function extFromFile(file: File): string {
  const raw = (file.name.split(".").pop() || "mp4").toLowerCase();
  return ["mp4", "mov", "webm", "m4v", "mkv"].includes(raw) ? raw : "mp4";
}

function bytesToBlobUrl(
  data: Uint8Array | string,
  mime: string
): string {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data as ArrayBuffer);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return URL.createObjectURL(new Blob([copy], { type: mime }));
}

/**
 * Decode any phone gallery clip → JPEG poster + H.264 MP4 blob URL for <video>.
 */
export async function generateClientVideoPreview(
  file: File,
  opts?: {
    onProgress?: (p: ClientPreviewProgress) => void;
    signal?: AbortSignal;
  }
): Promise<ClientPreviewResult> {
  if (opts?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const inputName = `preview_in.${extFromFile(file)}`;
  const posterName = "preview_poster.jpg";
  const outName = "preview_play.mp4";

  const report = (phase: ClientPreviewProgress["phase"], ratio: number) => {
    opts?.onProgress?.({ phase, ratio });
  };

  const ffmpeg = await getFfmpeg((p: ShortsMixProgress) => {
    if (p.message === "loading_engine") {
      report("loading_engine", Math.min(15, p.ratio));
    }
  });

  if (opts?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  report("loading_engine", 18);
  await safeDelete(ffmpeg, inputName);
  await safeDelete(ffmpeg, posterName);
  await safeDelete(ffmpeg, outName);
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  let posterUrl: string | null = null;
  report("poster", 22);
  try {
    const posterCode = await ffmpeg.exec([
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "0.5",
      "-i",
      inputName,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      "-y",
      posterName,
    ]);
    if (posterCode === 0) {
      const posterData = await ffmpeg.readFile(posterName);
      posterUrl = bytesToBlobUrl(posterData as Uint8Array, "image/jpeg");
    }
  } catch (err) {
    console.warn("[shorts/client-preview] poster extract failed", err);
  }

  report("poster", 35);

  let playableUrl: string | null = null;
  const large = file.size > 28 * 1024 * 1024;
  const maxSec = large ? "90" : "600";
  const scale = large ? "480:-2" : "720:-2";

  report("transcode", 40);
  try {
    const code = await ffmpeg.exec([
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputName,
      "-t",
      maxSec,
      "-vf",
      `scale=${scale}:flags=fast_bilinear`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "27",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      "-threads",
      "1",
      "-y",
      outName,
    ]);
    if (code === 0) {
      const outData = await ffmpeg.readFile(outName);
      playableUrl = bytesToBlobUrl(outData as Uint8Array, "video/mp4");
    }
  } catch (err) {
    console.warn("[shorts/client-preview] transcode failed", err);
  }

  await safeDelete(ffmpeg, inputName);
  await safeDelete(ffmpeg, posterName);
  await safeDelete(ffmpeg, outName);

  if (!posterUrl && !playableUrl) {
    throw new Error("client_preview_failed");
  }

  report("done", 100);
  return { posterUrl, playableUrl };
}

const FRAG_HEAD_BYTES = 1.5 * 1024 * 1024;
const FRAG_TAIL_BYTES = 2.2 * 1024 * 1024;

/** WASM poster from head+tail slices only (~4 MB) — safe on large Samsung HEVC files. */
export async function generateFragmentVideoPoster(
  file: File,
  opts?: { signal?: AbortSignal }
): Promise<string | null> {
  if (opts?.signal?.aborted) return null;

  const fragName = "frag.mp4";
  const tailName = "frag_tail.mp4";
  const posterName = "frag_poster.jpg";

  const ffmpeg = await getFfmpeg();
  if (opts?.signal?.aborted) return null;

  await safeDelete(ffmpeg, fragName);
  await safeDelete(ffmpeg, tailName);
  await safeDelete(ffmpeg, posterName);

  const headEnd = Math.min(file.size, FRAG_HEAD_BYTES);
  const tailStart = Math.max(0, file.size - FRAG_TAIL_BYTES);
  const headData = await fetchFile(file.slice(0, headEnd));
  const tailData = await fetchFile(file.slice(tailStart, file.size));

  const tryPoster = async (input: string, extraArgs: string[] = []) => {
    const code = await ffmpeg.exec([
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "+genpts+discardcorrupt+igndts",
      "-err_detect",
      "ignore_err",
      ...extraArgs,
      "-i",
      input,
      "-an",
      "-frames:v",
      "1",
      "-q:v",
      "3",
      "-y",
      posterName,
    ]);
    if (code !== 0) return null;
    const posterData = await ffmpeg.readFile(posterName);
    return bytesToBlobUrl(posterData as Uint8Array, "image/jpeg");
  };

  if (file.size > headEnd) {
    const combined = new Uint8Array(
      (headData as Uint8Array).byteLength + (tailData as Uint8Array).byteLength
    );
    combined.set(headData as Uint8Array, 0);
    combined.set(tailData as Uint8Array, (headData as Uint8Array).byteLength);
    await ffmpeg.writeFile(fragName, combined);
    const poster = await tryPoster(fragName);
    if (poster) return poster;
  }

  await ffmpeg.writeFile(tailName, tailData);
  const fromTail =
    (await tryPoster(tailName, ["-sseof", "-1"])) ??
    (await tryPoster(tailName, ["-sseof", "-0.5"])) ??
    (await tryPoster(tailName));

  await safeDelete(ffmpeg, fragName);
  await safeDelete(ffmpeg, tailName);
  await safeDelete(ffmpeg, posterName);
  return fromTail;
}

export function isMobileGalleryVideoClient(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)")?.matches === true
  );
}
