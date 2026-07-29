/**
 * Generate patent-office trademark logo JPG (945×945 @ ~300dpi / 8cm).
 * Run: node scripts/generate-trademark-logo.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "trademark_logo_final.jpg");
const SIZE = 945;

/** Lucide "sparkles" paths (viewBox 0 0 24 24) */
const SPARKLES = `
  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
  <path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>
`;

// Visual balance: icon + gap + wordmark, centered as a group
const ICON = 108;
const ICON_R = 28;
const GAP = 28;
const FONT_SIZE = 72;
// Approximate text width for "Studio Canvas AI" at 72px Georgia Bold
const TEXT_W = 560;
const GROUP_W = ICON + GAP + TEXT_W;
const GROUP_H = Math.max(ICON, FONT_SIZE + 8);
const OX = Math.round((SIZE - GROUP_W) / 2);
const OY = Math.round((SIZE - GROUP_H) / 2);
const TEXT_X = OX + ICON + GAP;
const TEXT_Y = OY + GROUP_H / 2 + FONT_SIZE * 0.35;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="#FFFFFF"/>
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
  </defs>
  <rect x="${OX}" y="${OY}" width="${ICON}" height="${ICON}" rx="${ICON_R}" ry="${ICON_R}" fill="url(#g)"/>
  <g transform="translate(${OX + ICON * 0.2}, ${OY + ICON * 0.2}) scale(${(ICON * 0.6) / 24})"
     fill="none" stroke="#FFFFFF" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
    ${SPARKLES}
  </g>
  <text x="${TEXT_X}" y="${TEXT_Y}"
        font-family="Georgia, 'Times New Roman', Times, serif"
        font-size="${FONT_SIZE}" font-weight="700" fill="#0D0E12"
        letter-spacing="-0.5">Studio Canvas AI</text>
</svg>`;

mkdirSync(dirname(OUT), { recursive: true });

const jpeg = await sharp(Buffer.from(svg))
  .resize(SIZE, SIZE, { fit: "fill" })
  .jpeg({
    quality: 95,
    chromaSubsampling: "4:4:4",
    mozjpeg: true,
  })
  .withMetadata({
    density: 300,
  })
  .toBuffer();

writeFileSync(OUT, jpeg);
console.log(`Wrote ${OUT} (${jpeg.length} bytes, ${SIZE}x${SIZE}, 300dpi)`);
