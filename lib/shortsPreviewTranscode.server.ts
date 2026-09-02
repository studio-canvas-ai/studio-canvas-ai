import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
  putR2Object,
} from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import { extractPosterFromBuffer } from "@/lib/shortsQuickPoster.server";

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

function previewKey(userId: string, videoId: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
  const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return `shorts/preview/${safeUser}/${safeId}.mp4`;
}

export async function generateMobilePreviewFromR2(params: {
  userId: string;
  videoId: string;
  sourceKey: string;
}): Promise<{ playbackUrl: string | null; posterDataUrl: string | null }> {
  if (!isR2Configured()) {
    return { playbackUrl: null, posterDataUrl: null };
  }

  const config = getR2Config()!;
  const client = createR2Client(config);
  const buffer = await getR2Object(client, config.bucketName, params.sourceKey);
  if (!buffer?.length) {
    return { playbackUrl: null, posterDataUrl: null };
  }

  const posterBuf = await extractPosterFromBuffer(buffer, "source.mp4");
  const posterDataUrl = posterBuf
    ? `data:image/jpeg;base64,${posterBuf.toString("base64")}`
    : null;

  const bin = resolveFfmpegPath();
  if (!bin) {
    return { playbackUrl: null, posterDataUrl };
  }

  const dir = await mkdtemp(path.join(tmpdir(), "sca-preview-tx-"));
  const inputPath = path.join(dir, "source.mp4");
  const outputPath = path.join(dir, "preview.mp4");

  try {
    await writeFile(inputPath, buffer);
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
    const key = previewKey(params.userId, params.videoId);
    await putR2Object(client, config.bucketName, key, previewMp4, "video/mp4");

    const { url } = await resolveDownloadUrl({ key, expiresInSec: 3600 });
    return { playbackUrl: url, posterDataUrl };
  } catch (err) {
    console.warn("[shorts/preview-transcode] ffmpeg failed", err);
    return { playbackUrl: null, posterDataUrl };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
