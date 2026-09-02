import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

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
      else reject(new Error(`ffmpeg_exit_${code}:${stderr.slice(-400)}`));
    });
  });
}

async function tryExtractPoster(
  bin: string,
  inputPath: string,
  outPath: string,
  atSec: number
): Promise<Buffer | null> {
  try {
    await runFfmpeg(bin, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "+genpts+discardcorrupt",
      "-ss",
      String(atSec),
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      "-y",
      outPath,
    ]);
    return await readFile(outPath);
  } catch {
    return null;
  }
}

/** Extract one JPEG from MP4 head/tail fragments (Samsung moov-at-end). */
export async function extractPosterFromFragments(
  head: Buffer,
  tail: Buffer
): Promise<Buffer | null> {
  const bin = resolveFfmpegPath();
  if (!bin) return null;

  const dir = await mkdtemp(path.join(tmpdir(), "sca-quick-poster-"));
  const inputPath = path.join(dir, "frag.mp4");
  const outPath = path.join(dir, "poster.jpg");

  try {
    await writeFile(inputPath, Buffer.concat([head, tail]));
    for (const at of [0.5, 1, 2, 0]) {
      const frame = await tryExtractPoster(bin, inputPath, outPath, at);
      if (frame?.byteLength) return frame;
    }
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function extractPosterFromBuffer(
  video: Buffer,
  fileName = "clip.mp4"
): Promise<Buffer | null> {
  const bin = resolveFfmpegPath();
  if (!bin) return null;

  const dir = await mkdtemp(path.join(tmpdir(), "sca-quick-poster-"));
  const inputPath = path.join(
    dir,
    fileName.replace(/[^\w.-]/g, "_") || "clip.mp4"
  );
  const outPath = path.join(dir, "poster.jpg");

  try {
    await writeFile(inputPath, video);
    for (const at of [0.5, 1, 2, 0]) {
      const frame = await tryExtractPoster(bin, inputPath, outPath, at);
      if (frame?.byteLength) return frame;
    }
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
