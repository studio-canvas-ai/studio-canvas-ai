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

async function readPosterFile(outPath: string): Promise<Buffer | null> {
  try {
    const frame = await readFile(outPath);
    return frame.byteLength > 0 ? frame : null;
  } catch {
    return null;
  }
}

async function runPosterAttempts(
  bin: string,
  inputPath: string,
  outPath: string,
  attempts: string[][]
): Promise<Buffer | null> {
  for (const args of attempts) {
    try {
      await runFfmpeg(bin, args);
      const frame = await readPosterFile(outPath);
      if (frame?.byteLength) return frame;
    } catch {
      /* try next strategy */
    }
  }
  return null;
}

const INPUT_FLAGS = [
  "-hide_banner",
  "-loglevel",
  "error",
  "-probesize",
  "48M",
  "-analyzeduration",
  "48M",
  "-fflags",
  "+genpts+discardcorrupt+igndts",
  "-err_detect",
  "ignore_err",
];

/** Samsung moov-at-end: tail fragment + seek from EOF. */
export async function extractPosterFromTail(tail: Buffer): Promise<Buffer | null> {
  const bin = resolveFfmpegPath();
  if (!bin || !tail.byteLength) return null;

  const dir = await mkdtemp(path.join(tmpdir(), "sca-quick-tail-"));
  const inputPath = path.join(dir, "tail.mp4");
  const outPath = path.join(dir, "poster.jpg");

  try {
    await writeFile(inputPath, tail);
    return await runPosterAttempts(bin, inputPath, outPath, [
      [...INPUT_FLAGS, "-sseof", "-2", "-i", inputPath, "-frames:v", "1", "-q:v", "3", "-y", outPath],
      [...INPUT_FLAGS, "-sseof", "-0.5", "-i", inputPath, "-frames:v", "1", "-q:v", "3", "-y", outPath],
      [...INPUT_FLAGS, "-i", inputPath, "-vf", "thumbnail", "-frames:v", "1", "-q:v", "3", "-y", outPath],
      [...INPUT_FLAGS, "-i", inputPath, "-frames:v", "1", "-q:v", "3", "-y", outPath],
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Extract one JPEG from MP4 head/tail fragments (Samsung moov-at-end). */
export async function extractPosterFromFragments(
  head: Buffer,
  tail: Buffer
): Promise<Buffer | null> {
  if (head.byteLength > 0 && tail.byteLength > 0) {
    const concat = await extractPosterFromBuffer(
      Buffer.concat([head, tail]),
      "frag.mp4"
    );
    if (concat?.byteLength) return concat;
  }

  if (tail.byteLength > 0) {
    const fromTail = await extractPosterFromTail(tail);
    if (fromTail?.byteLength) return fromTail;
  }

  if (head.byteLength > 0) {
    return extractPosterFromBuffer(head, "head.mp4");
  }

  return null;
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
    return await runPosterAttempts(bin, inputPath, outPath, [
      [...INPUT_FLAGS, "-ss", "0", "-i", inputPath, "-frames:v", "1", "-q:v", "3", "-y", outPath],
      [...INPUT_FLAGS, "-ss", "0.5", "-i", inputPath, "-frames:v", "1", "-q:v", "3", "-y", outPath],
      [...INPUT_FLAGS, "-i", inputPath, "-vf", "thumbnail", "-frames:v", "1", "-q:v", "3", "-y", outPath],
      [...INPUT_FLAGS, "-i", inputPath, "-frames:v", "1", "-q:v", "3", "-y", outPath],
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
