import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  getR2ObjectRange,
  headR2Object,
  isR2Configured,
  putR2Object,
} from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import {
  extractPosterFromBuffer,
  extractPosterFromTail,
} from "@/lib/shortsQuickPoster.server";

const TAIL_BYTES = 2.2 * 1024 * 1024;

function resolveFfmpegPath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("ffmpeg-static") as string | null | { default?: string };
    if (typeof mod === "string" && mod) return mod;
    if (mod && typeof mod === "object" && typeof mod.default === "string") {
      return mod.default;
    }
  } catch {
    /* optional */
  }
  return null;
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg_exit_${code}:${stderr.slice(-500)}`));
    });
  });
}

export function shortsPreviewKey(userId: string, videoId: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
  const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return `shorts/preview/${safeUser}/${safeId}.mp4`;
}

async function posterFromR2Tail(
  client: ReturnType<typeof createR2Client>,
  bucket: string,
  sourceKey: string
): Promise<string | null> {
  const head = await headR2Object(client, bucket, sourceKey);
  const size = head?.contentLength ?? 0;
  if (!size) return null;

  const tailStart = Math.max(0, size - TAIL_BYTES);
  const tail = await getR2ObjectRange(
    client,
    bucket,
    sourceKey,
    tailStart,
    size - 1
  );
  if (!tail?.length) return null;

  const posterBuf = await extractPosterFromTail(tail);
  return posterBuf
    ? `data:image/jpeg;base64,${posterBuf.toString("base64")}`
    : null;
}

async function transcodePreviewMp4(
  sourceBuffer: Buffer,
  userId: string,
  videoId: string
): Promise<string | null> {
  const bin = resolveFfmpegPath();
  if (!bin) return null;

  const config = getR2Config()!;
  const client = createR2Client(config);
  const dir = await mkdtemp(path.join(tmpdir(), "sca-preview-tx-"));
  const inputPath = path.join(dir, "source.mp4");
  const outputPath = path.join(dir, "preview.mp4");

  try {
    await writeFile(inputPath, sourceBuffer);
    await runFfmpeg(bin, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-t",
      "120",
      "-vf",
      "scale=540:-2:flags=fast_bilinear",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "27",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      "-y",
      outputPath,
    ]);

    const previewMp4 = await readFile(outputPath);
    const key = shortsPreviewKey(userId, videoId);
    await putR2Object(client, config.bucketName, key, previewMp4, "video/mp4");

    const { url } = await resolveDownloadUrl({ key, expiresInSec: 3600 });
    return url;
  } catch (err) {
    console.warn("[shorts/preview-transcode] ffmpeg failed", err);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function generateMobilePreviewFromR2(params: {
  userId: string;
  videoId: string;
  sourceKey: string;
}): Promise<{
  playbackUrl: string | null;
  posterDataUrl: string | null;
  cached: boolean;
}> {
  if (!isR2Configured()) {
    return { playbackUrl: null, posterDataUrl: null, cached: false };
  }

  const config = getR2Config()!;
  const client = createR2Client(config);
  const previewKey = shortsPreviewKey(params.userId, params.videoId);

  const cachedHead = await headR2Object(client, config.bucketName, previewKey);
  if (cachedHead?.contentLength) {
    const { url } = await resolveDownloadUrl({
      key: previewKey,
      expiresInSec: 3600,
    });
    const posterDataUrl = await posterFromR2Tail(
      client,
      config.bucketName,
      params.sourceKey
    );
    return { playbackUrl: url, posterDataUrl, cached: true };
  }

  const posterDataUrl = await posterFromR2Tail(
    client,
    config.bucketName,
    params.sourceKey
  );

  const buffer = await getR2Object(client, config.bucketName, params.sourceKey);
  if (!buffer?.length) {
    return { playbackUrl: null, posterDataUrl, cached: false };
  }

  let posterFromFull: string | null = posterDataUrl;
  if (!posterFromFull) {
    const posterBuf = await extractPosterFromBuffer(buffer, "source.mp4");
    posterFromFull = posterBuf
      ? `data:image/jpeg;base64,${posterBuf.toString("base64")}`
      : null;
  }

  const playbackUrl = await transcodePreviewMp4(
    buffer,
    params.userId,
    params.videoId
  );

  return {
    playbackUrl,
    posterDataUrl: posterFromFull,
    cached: false,
  };
}
