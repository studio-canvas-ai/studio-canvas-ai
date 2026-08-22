/**
 * Static verification for Shorts studio phase-4 sync contracts.
 * Run: node scripts/verify-shorts-studio-export.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportSrc = fs.readFileSync(
  path.join(root, "lib/shortsStudioExport.ts"),
  "utf8"
);
const studioSrc = fs.readFileSync(
  path.join(root, "components/ShortsTextEditStudio.tsx"),
  "utf8"
);
const fontsLoader = fs.readFileSync(
  path.join(root, "components/GoogleFontsLoader.tsx"),
  "utf8"
);
const stylesSrc = fs.readFileSync(
  path.join(root, "lib/thumbnailStyles.ts"),
  "utf8"
);

const mustInclude = (src, needle, label) => {
  assert.ok(src.includes(needle), `missing ${label}: ${needle}`);
};

// 1) Shared metrics used by preview + canvas
for (const token of [
  "shortsFontPx",
  "shortsBoxPad",
  "shortsBorderWidth",
  "SHORTS_LINE_HEIGHT",
  "clampBoxWidth",
  "ensureShortsFontsReady",
  "showBoxBorder",
  "maxWidth",
  "stickerId",
]) {
  mustInclude(exportSrc, token, "shortsStudioExport");
}

for (const token of [
  "shortsFontPx",
  "shortsBoxPad",
  "shortsBorderWidth",
  "SHORTS_LINE_HEIGHT",
  "clampBoxWidth",
  "ensureShortsFontsReady",
  "showBoxBorder",
  "insertSymbol",
  "STICKER_BADGE_IDS",
  "EMOJI_QUICK",
  "onResizePointerDown",
  "studioBgBorder",
]) {
  mustInclude(studioSrc, token, "ShortsTextEditStudio");
}

// 2) Font coverage for 10 locales
for (const family of [
  "Noto Sans KR",
  "Noto Sans JP",
  "Noto Sans SC",
  "Noto Sans TC",
  "Noto Sans Devanagari",
  "Anton",
  "Nunito",
  "Noto Serif",
]) {
  mustInclude(fontsLoader, family.replace(/ /g, "+").includes("+") ? family.replace(/ /g, "+") : family, "GoogleFontsLoader");
}

mustInclude(stylesSrc, 'return `${primary}, ${EMOJI_FONT}`', "preset-primary-first fontForText");
mustInclude(stylesSrc, "FONT_PRESET_PRIMARY", "primary map");
mustInclude(stylesSrc, "canvasFontShorthand", "canvas font helper");
mustInclude(exportSrc, "canvasFontShorthand", "canvas uses shorthand");
mustInclude(exportSrc, "ensurePresetFontLoaded", "per-preset load");
mustInclude(exportSrc, "document.fonts.load", "explicit font load");
mustInclude(fontsLoader, "Noto+Serif+KR", "Noto Serif KR loaded");
mustInclude(studioSrc, "FONT_PRESET_PRIMARY", "preview primary map");
mustInclude(studioSrc, "ensurePresetFontLoaded", "studio loads on click");
mustInclude(studioSrc, "data-font-primary", "preview primary attribute");
mustInclude(studioSrc, "fontWeight: 800", "preview weight not forced to 400");

console.log("verify-shorts-studio-export: OK");
