/**
 * Concatenate project sources into Full_Source_Code_v5.txt
 * Run: node scripts/export-full-source-v5.mjs
 */
import { createWriteStream, existsSync, readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative, sep } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "Full_Source_Code_v5.txt");

const INCLUDE_DIRS = ["app", "components", "lib", "scripts", "types", "public", "supabase"];
const INCLUDE_ROOT_FILES = [
  "middleware.ts",
  "middleware.js",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "tsconfig.json",
  "tailwind.config.ts",
  "tailwind.config.js",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.cjs",
  "eslint.config.mjs",
  "eslint.config.js",
  ".eslintrc.json",
  "vercel.json",
  "components.json",
  ".env.example",
  "README.md",
  "next-env.d.ts",
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".vercel",
  "coverage",
  ".turbo",
  ".data",
  ".temp",
  "agent-transcripts",
  "tmp-imgcheck",
]);

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".pdf",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".eot",
  ".mp4",
  ".mp3",
  ".wav",
  ".zip",
  ".gz",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".bin",
  ".wasm",
  ".svgz",
  ".psd",
  ".ai",
  ".sketch",
  ".fig",
]);

const SKIP_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
  "Full_Source_Code.txt",
  "Full_Source_Code_v2.txt",
  "Full_Source_Code_v3.txt",
  "Full_Source_Code_v4.txt",
  "Full_Source_Code_v5.txt",
  "tsconfig.tsbuildinfo",
]);

function toPosix(p) {
  return p.split(sep).join("/");
}

function shouldSkipFile(name) {
  if (SKIP_FILE_NAMES.has(name)) return true;
  if (name.startsWith(".env.") && name !== ".env.example") return true;
  if (name.startsWith("Full_Source_Code")) return true;
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot >= 0 && BINARY_EXT.has(lower.slice(dot))) return true;
  return false;
}

function isProbablyBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function walk(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldSkipFile(entry.name)) continue;
    out.push(full);
  }
}

const files = [];

for (const dir of INCLUDE_DIRS) {
  walk(join(ROOT, dir), files);
}

for (const name of INCLUDE_ROOT_FILES) {
  const full = join(ROOT, name);
  if (existsSync(full) && statSync(full).isFile() && !shouldSkipFile(name)) {
    files.push(full);
  }
}

const unique = [...new Set(files)];
unique.sort((a, b) => toPosix(relative(ROOT, a)).localeCompare(toPosix(relative(ROOT, b))));

const stream = createWriteStream(OUT, { encoding: "utf8" });
let written = 0;
let skippedBinary = 0;

stream.write(`# Studio Canvas AI — Full Source Code Dump (v5)\n`);
stream.write(`# Generated: ${new Date().toISOString()}\n`);
stream.write(`# Root: ${ROOT}\n\n`);

for (const full of unique) {
  const rel = toPosix(relative(ROOT, full));
  let buf;
  try {
    buf = readFileSync(full);
  } catch {
    skippedBinary++;
    continue;
  }
  if (isProbablyBinary(buf)) {
    skippedBinary++;
    continue;
  }
  const content = buf.toString("utf8");
  stream.write("================================================\n");
  stream.write(`FILE PATH: ${rel}\n`);
  stream.write("================================================\n");
  stream.write(content);
  if (!content.endsWith("\n")) stream.write("\n");
  stream.write("\n");
  written++;
}

await new Promise((resolve, reject) => {
  stream.end(() => resolve());
  stream.on("error", reject);
});

const sizeMb = (statSync(OUT).size / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${OUT}`);
console.log(`Files included: ${written}`);
console.log(`Skipped binary/unreadable: ${skippedBinary}`);
console.log(`Size: ${sizeMb} MB`);
