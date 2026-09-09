/**
 * Shorts hook-frame extraction — FFmpeg sampling + sharp interest scoring.
 * R2 thumb keys under thumbs/shorts/{userId}/{videoId}/…
 */

import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import sharp from "sharp";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
  putR2Object,
  publicObjectUrl,
} from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import {
  SHORTS_HOOK_COUNT_MAX,
  SHORTS_HOOK_COUNT_MIN,
  SHORTS_HOOK_SAMPLE_COUNT,
  buildHookTimestamps,
  shortsHookThumbKey,
  type ShortsHookFrame,
} from "@/lib/shortsHookShared";

export {
  SHORTS_HOOK_COUNT_MAX,
  SHORTS_HOOK_COUNT_MIN,
  SHORTS_HOOK_SAMPLE_COUNT,
  buildHookTimestamps,
  shortsHookThumbKey,
  type ShortsHookFrame,
};

/** Server-side R2 download cap for FFmpeg — match upload max (100 MB). */
export const SHORTS_EXTRACT_MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

function resolveFfmpegPath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("ffmpeg-static") as string | null | { default?: string };
    if (typeof mod === "string" && mod) return mod;
    if (mod && typeof mod === "object" && typeof mod.default === "string") {
      return mod.default;
    }
  } catch {
    /* optional binary */
  }
  return null;
}

function runFfmpeg(bin: string, args: string[]): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stderr });
      else reject(new Error(`ffmpeg_exit_${code}:${stderr.slice(-400)}`));
    });
  });
}

/** Parse `Duration: HH:MM:SS.xx` from ffmpeg -i stderr. */
export function parseFfmpegDuration(stderr: string): number | null {
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3]);
  if (![h, min, sec].every(Number.isFinite)) return null;
  return h * 3600 + min * 60 + sec;
}

/** Higher score ≈ more contrast / “interesting” still (lightweight heuristic). */
export async function scoreFrameInterest(jpegOrPng: Buffer): Promise<number> {
  const { data, info } = await sharp(jpegOrPng)
    .rotate()
    .resize({ width: 160, height: 160, fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  if (n <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) sum += data[i];
  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const d = data[i] - mean;
    varSum += d * d;
  }
  const std = Math.sqrt(varSum / n);
  const midBias = 1 - Math.min(1, Math.abs(mean - 128) / 128);
  return std * (0.55 + 0.45 * midBias);
}

export async function normalizeHookThumb(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({
      width: 720,
      height: 1280,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
}

async function extractOneFrame(
  bin: string,
  inputPath: string,
  atSec: number,
  outPath: string
): Promise<Buffer> {
  await runFfmpeg(bin, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(Math.max(0, atSec)),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    "-y",
    outPath,
  ]);
  return readFile(outPath);
}

async function probeDurationSec(bin: string, inputPath: string): Promise<number> {
  const stderr = await new Promise<string>((resolve) => {
    const child = spawn(bin, ["-hide_banner", "-i", inputPath], {
      windowsHide: true,
    });
    let out = "";
    child.stderr?.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.on("close", () => resolve(out));
    child.on("error", () => resolve(out));
  });
  return parseFfmpegDuration(stderr) || 8;
}

export async function extractHookFramesWithFfmpeg(
  videoBuffer: Buffer,
  fileName = "clip.mp4"
): Promise<Array<{ timestampSec: number; buffer: Buffer; score: number }>> {
  const bin = resolveFfmpegPath();
  if (!bin) throw new Error("ffmpeg_unavailable");

  const dir = await mkdtemp(path.join(tmpdir(), "sca-shorts-"));
  const inputPath = path.join(
    dir,
    fileName.replace(/[^\w.-]/g, "_") || "clip.mp4"
  );

  try {
    await writeFile(inputPath, videoBuffer);
    const duration = await probeDurationSec(bin, inputPath);
    const stamps = buildHookTimestamps(duration, SHORTS_HOOK_SAMPLE_COUNT);
    const frames: Array<{ timestampSec: number; buffer: Buffer; score: number }> =
      [];

    for (let i = 0; i < stamps.length; i += 1) {
      const outPath = path.join(dir, `frame-${i}.jpg`);
      try {
        const raw = await extractOneFrame(bin, inputPath, stamps[i], outPath);
        const score = await scoreFrameInterest(raw);
        frames.push({ timestampSec: stamps[i], buffer: raw, score });
      } catch (err) {
        console.warn("[shorts] frame extract skip", stamps[i], err);
      }
    }

    if (frames.length < SHORTS_HOOK_COUNT_MIN) {
      throw new Error("ffmpeg_too_few_frames");
    }

    frames.sort((a, b) => b.score - a.score);
    return frames.slice(0, SHORTS_HOOK_COUNT_MAX);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function downloadShortsVideoFromR2(
  key: string
): Promise<{ buffer: Buffer; size: number } | null> {
  if (!isR2Configured()) return null;
  const config = getR2Config()!;
  const client = createR2Client(config);
  const buffer = await getR2Object(client, config.bucketName, key);
  if (!buffer) return null;
  return { buffer, size: buffer.length };
}

export async function persistHookFramesToR2(params: {
  userId: string;
  videoId: string;
  frames: Array<{ timestampSec: number; buffer: Buffer; score: number }>;
}): Promise<ShortsHookFrame[]> {
  const ranked = [...params.frames].sort((a, b) => b.score - a.score);
  const picked = ranked.slice(0, SHORTS_HOOK_COUNT_MAX);
  const out: ShortsHookFrame[] = [];

  const r2 = isR2Configured() ? getR2Config() : null;
  const client = r2 ? createR2Client(r2) : null;

  for (let i = 0; i < picked.length; i += 1) {
    const frame = picked[i];
    const webp = await normalizeHookThumb(frame.buffer);
    const id = `hook-${i}`;
    let storageKey: string | null = null;
    let imageUrl: string;

    if (r2 && client) {
      storageKey = shortsHookThumbKey(params.userId, params.videoId, i);
      await putR2Object(client, r2.bucketName, storageKey, webp, "image/webp");
      try {
        const resolved = await resolveDownloadUrl({
          key: storageKey,
          expiresInSec: 3600,
        });
        imageUrl = resolved.url;
      } catch {
        imageUrl = publicObjectUrl(r2, storageKey);
      }
    } else {
      imageUrl = `data:image/webp;base64,${webp.toString("base64")}`;
    }

    out.push({
      id,
      index: i,
      timestampSec: frame.timestampSec,
      score: Math.round(frame.score * 10) / 10,
      imageUrl,
      storageKey,
    });
  }

  return out;
}
