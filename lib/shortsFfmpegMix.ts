"use client";

/**
 * Client-side Shorts mix via FFmpeg.wasm — stabilized pipeline:
 * 9:16 framing + permanent overlay + audio fallbacks + WASM-safe encode.
 *
 * All MEMFS paths use ASCII-only fixed names (never user upload filenames).
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { resolveBgmMixUrl } from "@/lib/bgmLibrary";
import { probeVideoDimensions } from "@/lib/shortsStudioExport";

/** YouTube Shorts / KR shorts master canvas */
export const SHORTS_MASTER_WIDTH = 1080;
export const SHORTS_MASTER_HEIGHT = 1920;

/** CapCut-style fit/zoom scale inside the 9:16 master canvas (50%–150%). */
export const SHORTS_VIDEO_SCALE_MIN = 0.5;
export const SHORTS_VIDEO_SCALE_MAX = 1.5;
export const SHORTS_VIDEO_SCALE_DEFAULT = 1;
/** Vertical center of the fitted video on the canvas (0=top … 1=bottom). */
export const SHORTS_VIDEO_POS_Y_DEFAULT = 0.5;

export type ShortsVideoLayout = {
  /** 0.5–1.5 — size relative to the full canvas contain-box (>1 = zoom-in) */
  scale: number;
  /** 0–1 — vertical center position of the video */
  posY: number;
};

export function clampVideoScale(v: number): number {
  const n = Number.isFinite(v) ? v : SHORTS_VIDEO_SCALE_DEFAULT;
  return Math.max(
    SHORTS_VIDEO_SCALE_MIN,
    Math.min(SHORTS_VIDEO_SCALE_MAX, n)
  );
}

export function clampVideoPosY(v: number): number {
  const n = Number.isFinite(v) ? v : SHORTS_VIDEO_POS_Y_DEFAULT;
  return Math.max(0, Math.min(1, n));
}

export function normalizeVideoLayout(
  layout?: Partial<ShortsVideoLayout> | null
): ShortsVideoLayout {
  return {
    scale: clampVideoScale(layout?.scale ?? SHORTS_VIDEO_SCALE_DEFAULT),
    posY: clampVideoPosY(layout?.posY ?? SHORTS_VIDEO_POS_Y_DEFAULT),
  };
}

/** Lighter canvas when 1080² encode OOMs in browser WASM */
const LIGHT_WIDTH = 720;
const LIGHT_HEIGHT = 1280;

/** Abort hung encodes (browser WASM can stall without progress). */
const MIX_TIMEOUT_MS = 3 * 60 * 1000;
const MIX_STALL_MS = 50 * 1000;

/** Prefer lighter canvas when source is huge (bytes or pixels). */
const LARGE_BLOB_BYTES = 35 * 1024 * 1024;

/** Safe fixed MEMFS basenames — no spaces, Hangul, commas, or parentheses. */
const FS_VIDEO_BASE = "input_video";
const FS_BGM_BASE = "input_bgm";
const FS_OVERLAY = "overlay.png";
const FS_OUTPUT = "output.mp4";

const SAFE_EXTS = new Set([
  "mp4",
  "webm",
  "mov",
  "mkv",
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "opus",
]);

export type ShortsMixProgress = {
  /** 0–100 */
  ratio: number;
  message: string;
};

type AudioMode = "amix" | "bgm" | "voice";
type CanvasSize = { width: number; height: number; label: string };

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

function resetFfmpegSingleton() {
  try {
    ffmpegSingleton?.terminate();
  } catch {
    /* ignore */
  }
  ffmpegSingleton = null;
  loadPromise = null;
}

async function getFfmpeg(
  onProgress?: (p: ShortsMixProgress) => void
): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      onProgress?.({
        ratio: Math.max(0, Math.min(100, Math.round((progress || 0) * 100))),
        message: "mixing",
      });
    });

    onProgress?.({ ratio: 2, message: "loading_engine" });
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });
    ffmpegSingleton = ffmpeg;
    onProgress?.({ ratio: 8, message: "engine_ready" });
    return ffmpeg;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err;
  }
}

function guessExtFromMime(mime: string, fallback: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("quicktime") || m.includes("mov")) return "mov";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("opus")) return "opus";
  if (m.includes("m4a")) return "m4a";
  if (m.includes("aac")) return "aac";
  if (m.includes("mp4")) return "mp4";
  return fallback;
}

/** ASCII-only extension from MIME or URL hint — never from raw user filenames. */
function safeMediaExt(
  mime: string | undefined,
  urlOrNameHint: string | undefined,
  fallback: string
): string {
  const fromMime = mime ? guessExtFromMime(mime, "") : "";
  if (fromMime && SAFE_EXTS.has(fromMime)) return fromMime;

  if (urlOrNameHint) {
    try {
      const path = urlOrNameHint.includes("://")
        ? new URL(urlOrNameHint).pathname
        : urlOrNameHint;
      const match = path.match(/\.([A-Za-z0-9]{2,5})$/);
      if (match) {
        const ext = match[1].toLowerCase();
        if (SAFE_EXTS.has(ext)) return ext;
      }
    } catch {
      /* ignore bad URL */
    }
  }
  return fallback;
}

async function safeDelete(ffmpeg: FFmpeg, name: string) {
  try {
    await ffmpeg.deleteFile(name);
  } catch {
    /* ignore */
  }
}

/**
 * Extract mono 16kHz WAV for Whisper STT (small payload for Vercel + OpenAI).
 * Prefer this over uploading the full video blob.
 */
export async function extractShortsAudioForStt(
  videoBlob: Blob,
  onProgress?: (p: ShortsMixProgress) => void
): Promise<Blob> {
  if (!videoBlob || videoBlob.size <= 0) {
    throw new Error("stt_audio_empty_source");
  }

  const ffmpeg = await getFfmpeg((p) => {
    if (p.message === "loading_engine" || p.message === "engine_ready") {
      onProgress?.({ ratio: p.ratio, message: p.message });
    } else {
      onProgress?.({
        ratio: Math.max(10, Math.min(90, p.ratio)),
        message: "extracting_audio",
      });
    }
  });

  const videoExt = safeMediaExt(videoBlob.type, undefined, "mp4");
  const inName = `stt_in.${videoExt}`;
  const outName = "stt_audio.wav";

  await safeDelete(ffmpeg, inName);
  await safeDelete(ffmpeg, outName);
  onProgress?.({ ratio: 12, message: "extracting_audio" });
  await ffmpeg.writeFile(inName, await fetchFile(videoBlob));

  const code = await ffmpeg.exec([
    "-i",
    inName,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outName,
  ]);

  if (code !== 0) {
    await safeDelete(ffmpeg, inName);
    await safeDelete(ffmpeg, outName);
    console.error("[shorts/stt-client] ffmpeg extract exit", code);
    throw new Error(`stt_audio_extract_failed_${code}`);
  }

  const data = await ffmpeg.readFile(outName);
  await safeDelete(ffmpeg, inName);
  await safeDelete(ffmpeg, outName);

  const bytes =
    data instanceof Uint8Array
      ? data
      : new TextEncoder().encode(String(data));
  // Ensure BlobPart is a real ArrayBuffer-backed view (WASM MEMFS can return SharedArrayBuffer views).
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  const blob = new Blob([copy], { type: "audio/wav" });
  onProgress?.({ ratio: 95, message: "extracting_audio" });
  console.info("[shorts/stt-client] extracted wav", {
    inBytes: videoBlob.size,
    outBytes: blob.size,
    inExt: videoExt,
  });
  if (blob.size <= 44) {
    throw new Error("stt_audio_extract_empty");
  }
  return blob;
}

/**
 * Map UI slider (0–1) → FFmpeg BGM gain.
 * (Weights omitted on purpose — spaces in amix weights break some WASM builds.)
 */
export function mapBgmSliderToMix(slider: number): {
  voiceGain: number;
  bgmGain: number;
  amixWeights: string;
} {
  const t = Math.max(0, Math.min(1, Number.isFinite(slider) ? slider : 0.5));
  const curved = Math.pow(t, 0.85);
  const bgmGain = Number((curved * 2.8).toFixed(3));
  return {
    voiceGain: 1.0,
    bgmGain,
    amixWeights: "1 1",
  };
}

/** WASM-safe H.264 flags — no movflags/faststart (MEMFS rewrite risk), single thread. */
const ENCODE_VIDEO_ARGS = [
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-crf",
  "28",
  "-threads",
  "1",
  "-pix_fmt",
  "yuv420p",
] as const;

const ENCODE_AUDIO_ARGS = ["-c:a", "aac", "-b:a", "128k", "-shortest"] as const;

/**
 * CapCut-style layout on a black 9:16 master:
 * - scale ≤ 1: contain into (canvas×scale) then pad (letterbox)
 * - scale > 1: zoom past canvas, crop to frame (overflow clipped)
 * Horizontal center + user posY for vertical placement.
 */
function buildBaseVideoFilter(
  canvasW: number,
  canvasH: number,
  layout: ShortsVideoLayout
): string {
  const scale = clampVideoScale(layout.scale);
  const posY = clampVideoPosY(layout.posY);
  const boxW = Math.max(2, Math.round(canvasW * scale));
  const boxH = Math.max(2, Math.round(canvasH * scale));

  // Crop window when zoomed-in (scaled frame larger than canvas)
  const cropW = `min(iw\\,${canvasW})`;
  const cropH = `min(ih\\,${canvasH})`;
  const cropX = `(iw-${cropW})/2`;
  const cropY = `max(0\\,min(ih-${cropH}\\,${posY}*ih-${cropH}/2))`;

  // Pad placement when letterboxed (scaled frame smaller than canvas)
  const padX = `(ow-iw)/2`;
  const padY = `max(0\\,min(oh-ih\\,${posY}*oh-ih/2))`;

  return (
    `[0:v]scale=${boxW}:${boxH}:force_original_aspect_ratio=decrease,` +
    `crop=${cropW}:${cropH}:${cropX}:${cropY},` +
    `pad=${canvasW}:${canvasH}:${padX}:${padY}:black,` +
    `format=yuv420p,setsar=1[base]`
  );
}

export type TimedCaptionOverlay = {
  png: Blob;
  startSec: number;
  endSec: number;
};

function buildVideoBranch(params: {
  canvasW: number;
  canvasH: number;
  layout: ShortsVideoLayout;
  /** Timed caption PNGs (inputs start at index 1). */
  captions: { startSec: number; endSec: number }[];
  /** Permanent design overlay after captions (input after caption slots). */
  hasStaticOverlay: boolean;
}): string {
  const { canvasW, canvasH, layout, captions, hasStaticOverlay } = params;
  const base = buildBaseVideoFilter(canvasW, canvasH, layout);

  if (!captions.length && !hasStaticOverlay) {
    return base.replace(/\[base\]$/, "[vout]");
  }

  const parts: string[] = [base];
  let current = "base";
  const lastCaptionIdx = captions.length - 1;

  for (let i = 0; i < captions.length; i++) {
    const inIdx = 1 + i;
    const isLastVideoOp = i === lastCaptionIdx && !hasStaticOverlay;
    const next = isLastVideoOp ? "vout" : `vc${i}`;
    const s = Math.max(0, captions[i].startSec).toFixed(3);
    const e = Math.max(Number(s) + 0.05, captions[i].endSec).toFixed(3);
    parts.push(
      `[${inIdx}:v]scale=${canvasW}:${canvasH},format=rgba[cap${i}]`
    );
    parts.push(
      `[${current}][cap${i}]overlay=0:0:eof_action=repeat:` +
        `enable='between(t\\,${s}\\,${e})'[${next}]`
    );
    current = next;
  }

  if (hasStaticOverlay) {
    const inIdx = 1 + captions.length;
    parts.push(
      `[${inIdx}:v]scale=${canvasW}:${canvasH},format=rgba[ov]`
    );
    parts.push(
      `[${current}][ov]overlay=0:0:eof_action=repeat[vout]`
    );
  }

  return parts.join(";");
}

function buildAudioBranch(params: {
  audioMode: AudioMode;
  bgmInputIndex: number;
  voiceGain: number;
  bgmGain: number;
}): string {
  const { audioMode, bgmInputIndex, voiceGain, bgmGain } = params;
  if (audioMode === "bgm") {
    return `[${bgmInputIndex}:a]volume=${bgmGain}[aout]`;
  }
  if (audioMode === "voice") {
    return `[0:a]volume=${voiceGain}[aout]`;
  }
  return (
    `[0:a]volume=${voiceGain}[a1];` +
    `[${bgmInputIndex}:a]volume=${bgmGain}[a2];` +
    `[a1][a2]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`
  );
}

function buildFilterComplex(params: {
  canvasW: number;
  canvasH: number;
  layout: ShortsVideoLayout;
  captions: { startSec: number; endSec: number }[];
  hasStaticOverlay: boolean;
  audioMode: AudioMode;
  voiceGain: number;
  bgmGain: number;
}): string {
  const bgmInputIndex =
    1 + params.captions.length + (params.hasStaticOverlay ? 1 : 0);
  return (
    buildVideoBranch(params) +
    ";" +
    buildAudioBranch({
      audioMode: params.audioMode,
      bgmInputIndex,
      voiceGain: params.voiceGain,
      bgmGain: params.bgmGain,
    })
  );
}

type LogBuffer = { lines: string[] };

function attachLogCapture(ffmpeg: FFmpeg, buf: LogBuffer): () => void {
  const onLog = ({ type, message }: { type: string; message: string }) => {
    const line = `[${type}] ${message}`;
    buf.lines.push(line);
    if (buf.lines.length > 500) buf.lines.splice(0, buf.lines.length - 500);
    if (process.env.NODE_ENV === "development") {
      console.debug("[ffmpeg]", line);
    }
  };
  ffmpeg.on("log", onLog);
  return () => {
    try {
      (ffmpeg as unknown as { off?: (e: string, cb: unknown) => void }).off?.(
        "log",
        onLog
      );
    } catch {
      /* ignore */
    }
  };
}

function dumpFfmpegLogs(buf: LogBuffer, context: string, detail?: unknown) {
  const stderr = buf.lines
    .filter(
      (l) =>
        l.startsWith("[fferr]") ||
        l.startsWith("[stderr]") ||
        /error|invalid|fail|no such|matches no/i.test(l)
    )
    .join("\n");
  const tail = buf.lines.slice(-100).join("\n");
  console.error(`[shorts/ffmpeg] ${context}`, detail ?? "");
  if (stderr) {
    console.error("[shorts/ffmpeg] stderr:\n" + stderr);
  }
  if (tail) {
    console.error("[shorts/ffmpeg] log tail:\n" + tail);
  }
  if (!stderr && !tail) {
    console.error("[shorts/ffmpeg] (no log lines captured)");
  }
}

/**
 * Run ffmpeg.exec with hard timeout + stall detection to avoid infinite UI wait.
 * Returns exit code, or -1 on abort (timeout/stall/throw) after logging.
 */
async function execGuarded(
  ffmpeg: FFmpeg,
  args: string[],
  onProgress?: (p: ShortsMixProgress) => void,
  logBuf?: LogBuffer
): Promise<number> {
  let lastBeat = Date.now();
  const onProg = ({ progress }: { progress: number }) => {
    lastBeat = Date.now();
    onProgress?.({
      ratio: Math.max(0, Math.min(99, Math.round((progress || 0) * 100))),
      message: "mixing",
    });
  };
  ffmpeg.on("progress", onProg);

  let hardTimer: ReturnType<typeof setTimeout> | null = null;
  let stallTimer: ReturnType<typeof setInterval> | null = null;
  let aborted = false;

  const cleanupWatchdogs = () => {
    if (hardTimer) clearTimeout(hardTimer);
    if (stallTimer) clearInterval(stallTimer);
    hardTimer = null;
    stallTimer = null;
    try {
      (ffmpeg as unknown as { off?: (e: string, cb: unknown) => void }).off?.(
        "progress",
        onProg
      );
    } catch {
      /* ignore */
    }
  };

  try {
    return await new Promise<number>((resolve, reject) => {
      hardTimer = setTimeout(() => {
        aborted = true;
        reject(new Error("ffmpeg_timeout"));
      }, MIX_TIMEOUT_MS);

      stallTimer = setInterval(() => {
        if (Date.now() - lastBeat > MIX_STALL_MS) {
          aborted = true;
          reject(new Error("ffmpeg_stall"));
        }
      }, 5000);

      lastBeat = Date.now();
      void ffmpeg.exec(args).then(
        (code) => {
          cleanupWatchdogs();
          resolve(code);
        },
        (err) => {
          cleanupWatchdogs();
          reject(err);
        }
      );
    });
  } catch (err) {
    cleanupWatchdogs();
    if (logBuf) dumpFfmpegLogs(logBuf, "exec aborted", err);
    if (aborted) resetFfmpegSingleton();
    return -1;
  }
}

type Attempt = {
  canvas: CanvasSize;
  useStaticOverlay: boolean;
  audioMode: AudioMode;
  label: string;
};

function buildAttemptPlan(params: {
  hasStaticOverlay: boolean;
  preferLight: boolean;
  hasBgm: boolean;
}): Attempt[] {
  const { hasStaticOverlay, preferLight, hasBgm } = params;
  const full: CanvasSize = {
    width: SHORTS_MASTER_WIDTH,
    height: SHORTS_MASTER_HEIGHT,
    label: "1080x1920",
  };
  const light: CanvasSize = {
    width: LIGHT_WIDTH,
    height: LIGHT_HEIGHT,
    label: "720x1280",
  };
  const canvases = preferLight ? [light, full] : [full, light];
  const attempts: Attempt[] = [];
  const staticFlags = hasStaticOverlay ? [true, false] : [false];
  const audioModes: AudioMode[] = hasBgm
    ? ["amix", "bgm", "voice"]
    : ["voice"];

  for (const canvas of canvases) {
    for (const useStaticOverlay of staticFlags) {
      const tag = useStaticOverlay ? "overlay" : "plain";
      for (const audioMode of audioModes) {
        attempts.push({
          canvas,
          useStaticOverlay,
          audioMode,
          label: `${canvas.label}+${tag}+${audioMode}`,
        });
      }
    }
  }

  return attempts;
}

/**
 * Frame source video into 9:16, burn permanent text overlay for the full
 * duration, optionally mix voice + BGM — with multi-tier audio/canvas fallbacks.
 */
export async function mixShortsVideoWithBgm(params: {
  videoBlob: Blob;
  /** Optional — when omitted, original video audio is kept (voice-only path). */
  bgmUrl?: string | null;
  bgmVolume?: number;
  /** Transparent text/design overlay PNG sized to the 9:16 master canvas. */
  overlayPng?: Blob | null;
  /** Timed caption overlays (full-canvas PNGs gated by enable=between). */
  captions?: TimedCaptionOverlay[] | null;
  /** CapCut-style scale / vertical position inside the master canvas. */
  layout?: Partial<ShortsVideoLayout> | null;
  onProgress?: (p: ShortsMixProgress) => void;
}): Promise<Blob> {
  const { videoBlob, bgmUrl, bgmVolume, overlayPng, onProgress } = params;
  const hasBgm = Boolean(bgmUrl && String(bgmUrl).trim());
  const layout = normalizeVideoLayout(params.layout);
  const vol = Math.max(0, Math.min(1, Number.isFinite(bgmVolume) ? bgmVolume! : 0.5));
  const { voiceGain, bgmGain } = mapBgmSliderToMix(vol);
  const hasStaticOverlay = Boolean(overlayPng && overlayPng.size > 0);
  const captionOverlays = (params.captions || []).filter(
    (c) => c.png && c.png.size > 0 && c.endSec > c.startSec
  );

  const logBuf: LogBuffer = { lines: [] };
  let detachLogs: (() => void) | null = null;

  onProgress?.({ ratio: 10, message: "loading_files" });

  let srcW = 0;
  let srcH = 0;
  try {
    const dim = await probeVideoDimensions(videoBlob);
    srcW = dim.width;
    srcH = dim.height;
  } catch (err) {
    console.warn("[shorts/ffmpeg] probe dimensions failed", err);
  }

  const preferLight =
    videoBlob.size >= LARGE_BLOB_BYTES ||
    (srcW > 0 && srcH > 0 && srcW * srcH > SHORTS_MASTER_WIDTH * SHORTS_MASTER_HEIGHT * 1.35);

  console.info("[shorts/ffmpeg] source", {
    srcW,
    srcH,
    bytes: videoBlob.size,
    preferLight,
    hasStaticOverlay,
    hasBgm,
    captionCount: captionOverlays.length,
    layout,
  });

  const videoExt = safeMediaExt(videoBlob.type, undefined, "mp4");
  const videoName = `${FS_VIDEO_BASE}.${videoExt}`;
  const overlayName = FS_OVERLAY;
  const outputName = FS_OUTPUT;
  const captionNames = captionOverlays.map((_, i) => `cap_${i}.png`);

  let bgmName = "";
  let bgmBytes: Uint8Array | null = null;
  if (hasBgm && bgmUrl) {
    onProgress?.({ ratio: 18, message: "loading_bgm" });
    const bgmFetchUrl = resolveBgmMixUrl(bgmUrl);
    const bgmRes = await fetch(bgmFetchUrl);
    if (!bgmRes.ok) {
      throw new Error(`bgm_fetch_${bgmRes.status}`);
    }
    const bgmBlob = await bgmRes.blob();
    const bgmExt = safeMediaExt(bgmBlob.type, bgmUrl, "mp3");
    bgmName = `${FS_BGM_BASE}.${bgmExt}`;
    bgmBytes = await fetchFile(bgmBlob);
  }

  const videoBytes = await fetchFile(videoBlob);
  const overlayBytes =
    hasStaticOverlay && overlayPng ? await fetchFile(overlayPng) : null;
  const captionBytes = await Promise.all(
    captionOverlays.map((c) => fetchFile(c.png))
  );
  const captionTimes = captionOverlays.map((c) => ({
    startSec: c.startSec,
    endSec: c.endSec,
  }));

  async function prepareFs(ffmpeg: FFmpeg) {
    await safeDelete(ffmpeg, videoName);
    if (bgmName) await safeDelete(ffmpeg, bgmName);
    await safeDelete(ffmpeg, overlayName);
    await safeDelete(ffmpeg, outputName);
    await safeDelete(ffmpeg, `input.${videoExt}`);
    await safeDelete(ffmpeg, "bgm.mp3");
    for (const name of captionNames) {
      await safeDelete(ffmpeg, name);
    }
    await ffmpeg.writeFile(videoName, videoBytes);
    for (let i = 0; i < captionBytes.length; i++) {
      await ffmpeg.writeFile(captionNames[i], captionBytes[i]);
    }
    if (overlayBytes) {
      await ffmpeg.writeFile(overlayName, overlayBytes);
    }
    if (bgmName && bgmBytes) {
      await ffmpeg.writeFile(bgmName, bgmBytes);
    }
  }

  try {
    let ffmpeg = await getFfmpeg(onProgress);
    detachLogs = attachLogCapture(ffmpeg, logBuf);
    await prepareFs(ffmpeg);

    onProgress?.({ ratio: 35, message: "mixing" });

    const attempts = buildAttemptPlan({
      hasStaticOverlay,
      preferLight,
      hasBgm,
    });

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      // Engine may have been reset after stall — reload + rewrite MEMFS.
      if (!ffmpegSingleton?.loaded) {
        detachLogs?.();
        ffmpeg = await getFfmpeg(onProgress);
        detachLogs = attachLogCapture(ffmpeg, logBuf);
        await prepareFs(ffmpeg);
      }

      await safeDelete(ffmpeg, outputName);

      const useStatic = attempt.useStaticOverlay && Boolean(overlayBytes);
      const filterComplex = buildFilterComplex({
        canvasW: attempt.canvas.width,
        canvasH: attempt.canvas.height,
        layout,
        captions: captionTimes,
        hasStaticOverlay: useStatic,
        audioMode: attempt.audioMode,
        voiceGain,
        bgmGain,
      });

      const inputArgs = ["-i", videoName];
      for (const name of captionNames) {
        inputArgs.push("-i", name);
      }
      if (useStatic) {
        inputArgs.push("-i", overlayName);
      }
      if (hasBgm && bgmName) {
        inputArgs.push("-i", bgmName);
      }

      console.info("[shorts/ffmpeg] attempt", {
        i: i + 1,
        of: attempts.length,
        label: attempt.label,
        captions: captionTimes.length,
        layout,
        filterComplex,
      });

      const code = await execGuarded(
        ffmpeg,
        [
          ...inputArgs,
          "-filter_complex",
          filterComplex,
          "-map",
          "[vout]",
          "-map",
          "[aout]",
          ...ENCODE_VIDEO_ARGS,
          ...ENCODE_AUDIO_ARGS,
          outputName,
        ],
        onProgress,
        logBuf
      );

      if (code === 0) {
        onProgress?.({ ratio: 92, message: "encoding" });
        const data = await ffmpeg.readFile(outputName);
        const bytes =
          data instanceof Uint8Array
            ? data
            : new TextEncoder().encode(String(data));
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);

        await safeDelete(ffmpeg, videoName);
        if (bgmName) await safeDelete(ffmpeg, bgmName);
        await safeDelete(ffmpeg, overlayName);
        await safeDelete(ffmpeg, outputName);

        console.info("[shorts/ffmpeg] success", attempt.label);
        onProgress?.({ ratio: 100, message: "done" });
        return new Blob([copy.buffer], { type: "video/mp4" });
      }

      dumpFfmpegLogs(logBuf, `attempt failed: ${attempt.label}`, { code });
      // Clear buffer noise between attempts but keep last failures visible in console
      if (logBuf.lines.length > 200) {
        logBuf.lines.splice(0, logBuf.lines.length - 80);
      }
    }

    // Last resort: stream-copy (optional BGM remap) without framing / overlay
    console.warn(
      "[shorts/ffmpeg] all framed attempts failed — stream-copy fallback"
    );
    if (!ffmpegSingleton?.loaded) {
      detachLogs?.();
      ffmpeg = await getFfmpeg(onProgress);
      detachLogs = attachLogCapture(ffmpeg, logBuf);
      await prepareFs(ffmpeg);
    }
    await safeDelete(ffmpeg, outputName);
    const copyArgs = hasBgm && bgmName
      ? [
          "-i",
          videoName,
          "-i",
          bgmName,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-shortest",
          outputName,
        ]
      : [
          "-i",
          videoName,
          "-map",
          "0:v:0",
          "-map",
          "0:a?",
          "-c",
          "copy",
          outputName,
        ];
    const copyCode = await execGuarded(
      ffmpeg,
      copyArgs,
      onProgress,
      logBuf
    );

    if (copyCode === 0) {
      const data = await ffmpeg.readFile(outputName);
      const bytes =
        data instanceof Uint8Array
          ? data
          : new TextEncoder().encode(String(data));
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      await safeDelete(ffmpeg, videoName);
      if (bgmName) await safeDelete(ffmpeg, bgmName);
      await safeDelete(ffmpeg, overlayName);
      await safeDelete(ffmpeg, outputName);
      onProgress?.({ ratio: 100, message: "done" });
      return new Blob([copy.buffer], { type: "video/mp4" });
    }

    dumpFfmpegLogs(logBuf, "all attempts exhausted", { copyCode });
    throw new Error("ffmpeg_all_attempts_failed");
  } catch (err) {
    dumpFfmpegLogs(logBuf, "mix failed", err);
    throw err;
  } finally {
    detachLogs?.();
  }
}

export function triggerVideoDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".mp4") ? filename : `${filename}.mp4`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
