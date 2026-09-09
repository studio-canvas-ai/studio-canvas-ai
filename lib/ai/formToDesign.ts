/**
 * Form-to-Design — map Print Smart Form fields → independent TextLayer overlays.
 * AI never receives these strings for pixel burn-in.
 */

import { createLayer, type TextLayer, type TextPos, type FontPreset, type TextAlign } from "@/lib/thumbnailStyles";
import { formatFormFieldText } from "@/lib/printWizardTextFormat";
import type { FieldLayoutKind, SmartInputValues } from "@/lib/printWizardTypes";

export type FormToDesignLayerSpec = {
  field: keyof SmartInputValues;
  pos: TextPos;
  fontSize: number;
  fontWeight: number;
  offsetY: number;
  maxWidth: number;
  color: TextLayer["color"];
  fontPreset?: FontPreset;
  align?: TextAlign;
  letterSpacing?: number;
};

const DEFAULT_SPECS: FormToDesignLayerSpec[] = [
  {
    field: "date",
    pos: "top",
    fontSize: 28,
    fontWeight: 600,
    offsetY: -0.02,
    maxWidth: 0.85,
    color: "inkBlack",
  },
  {
    field: "title",
    pos: "center",
    fontSize: 56,
    fontWeight: 800,
    offsetY: -0.08,
    maxWidth: 0.9,
    color: "inkBlack",
  },
  {
    field: "subtitle",
    pos: "center",
    fontSize: 32,
    fontWeight: 500,
    offsetY: 0.02,
    maxWidth: 0.88,
    color: "inkBlack",
  },
  {
    field: "location",
    pos: "bottom",
    fontSize: 26,
    fontWeight: 500,
    offsetY: -0.12,
    maxWidth: 0.85,
    color: "inkBlack",
  },
  {
    field: "organizer",
    pos: "bottom",
    fontSize: 22,
    fontWeight: 500,
    offsetY: -0.04,
    maxWidth: 0.85,
    color: "inkBlack",
  },
  {
    field: "programs",
    pos: "bottom",
    fontSize: 20,
    fontWeight: 400,
    offsetY: 0.06,
    maxWidth: 0.82,
    color: "inkBlack",
    align: "left",
  },
];

function cloneSpecs(): FormToDesignLayerSpec[] {
  return DEFAULT_SPECS.map((s) => ({ ...s }));
}

function patchSpec(
  specs: FormToDesignLayerSpec[],
  field: keyof SmartInputValues,
  patch: Partial<FormToDesignLayerSpec>
) {
  const target = specs.find((s) => s.field === field);
  if (target) Object.assign(target, patch);
}

/** Layout composition presets driven by 분야 selection. */
export function specsForFieldLayout(
  layout?: FieldLayoutKind | null
): FormToDesignLayerSpec[] {
  const specs = cloneSpecs();
  if (!layout) return specs;

  switch (layout) {
    case "poster-bold":
      patchSpec(specs, "title", {
        fontSize: 64,
        fontWeight: 800,
        letterSpacing: 2,
        fontPreset: "poster",
        offsetY: -0.06,
      });
      patchSpec(specs, "subtitle", { fontSize: 30, offsetY: 0.04 });
      break;
    case "festival":
      patchSpec(specs, "title", {
        fontSize: 58,
        fontPreset: "jalnan",
        letterSpacing: 1,
      });
      break;
    case "formal":
      patchSpec(specs, "title", {
        fontSize: 48,
        fontWeight: 700,
        fontPreset: "serif",
        letterSpacing: 1,
      });
      break;
    case "seminar":
      patchSpec(specs, "title", {
        fontSize: 46,
        fontWeight: 700,
        fontPreset: "pretendard",
        letterSpacing: 0,
      });
      patchSpec(specs, "programs", { fontSize: 22, offsetY: 0.08, maxWidth: 0.86 });
      break;
    case "corporate":
      patchSpec(specs, "title", {
        fontSize: 48,
        fontWeight: 700,
        fontPreset: "pretendard",
        offsetY: -0.12,
      });
      patchSpec(specs, "subtitle", { fontSize: 26, offsetY: -0.02 });
      break;
    case "product":
      patchSpec(specs, "title", {
        fontSize: 52,
        fontPreset: "gmarket",
        offsetY: -0.1,
      });
      break;
    case "public":
      patchSpec(specs, "title", {
        fontSize: 46,
        fontWeight: 700,
        fontPreset: "pretendard",
      });
      patchSpec(specs, "organizer", { fontSize: 24, offsetY: -0.02 });
      break;
    case "menu":
      patchSpec(specs, "title", {
        fontSize: 50,
        fontPreset: "gmarket",
        offsetY: -0.14,
      });
      patchSpec(specs, "programs", { fontSize: 22, offsetY: 0.1, maxWidth: 0.78 });
      patchSpec(specs, "location", { offsetY: -0.08 });
      break;
    case "cafe":
      patchSpec(specs, "title", {
        fontSize: 48,
        fontPreset: "rounded",
        fontWeight: 700,
      });
      break;
    case "bar":
      patchSpec(specs, "title", {
        fontSize: 50,
        fontPreset: "impact",
        letterSpacing: 1,
      });
      break;
    case "wedding":
      patchSpec(specs, "title", {
        fontSize: 46,
        fontWeight: 500,
        fontPreset: "classicMyeongjo",
        letterSpacing: 4,
        offsetY: -0.04,
      });
      patchSpec(specs, "subtitle", {
        fontSize: 28,
        fontPreset: "classicMyeongjo",
        offsetY: 0.06,
      });
      break;
    case "celebration":
      patchSpec(specs, "title", {
        fontSize: 54,
        fontPreset: "jua",
        letterSpacing: 1,
      });
      break;
    case "party":
      patchSpec(specs, "title", {
        fontSize: 52,
        fontPreset: "rounded",
        letterSpacing: 1,
      });
      break;
    case "education":
      patchSpec(specs, "title", {
        fontSize: 48,
        fontPreset: "pretendard",
        fontWeight: 800,
      });
      patchSpec(specs, "programs", { fontSize: 22, offsetY: 0.08 });
      break;
    case "realestate":
      patchSpec(specs, "title", {
        fontSize: 50,
        fontPreset: "gmarket",
        fontWeight: 800,
      });
      patchSpec(specs, "location", { fontSize: 28, offsetY: -0.08 });
      break;
    case "invitation":
      patchSpec(specs, "title", {
        fontSize: 36,
        fontWeight: 500,
        fontPreset: "classicMyeongjo",
        letterSpacing: 3,
        offsetY: -0.1,
        maxWidth: 0.78,
      });
      patchSpec(specs, "subtitle", {
        fontSize: 22,
        fontPreset: "classicMyeongjo",
        offsetY: -0.02,
        maxWidth: 0.78,
      });
      patchSpec(specs, "date", { fontSize: 18, offsetY: 0.1, maxWidth: 0.72 });
      patchSpec(specs, "location", {
        fontSize: 16,
        offsetY: 0.16,
        maxWidth: 0.72,
      });
      patchSpec(specs, "organizer", {
        fontSize: 16,
        offsetY: 0.22,
        maxWidth: 0.72,
      });
      patchSpec(specs, "programs", {
        fontSize: 15,
        offsetY: 0.28,
        maxWidth: 0.72,
      });
      break;
    default:
      break;
  }
  return specs;
}

export function applyFieldLayoutToLayers(
  layers: TextLayer[],
  layout?: FieldLayoutKind | null
): TextLayer[] {
  const specs = specsForFieldLayout(layout);
  return layers.map((layer) => {
    if (!layer.id.startsWith("form-")) return layer;
    const field = layer.id.slice(5) as keyof SmartInputValues;
    const spec = specs.find((s) => s.field === field);
    if (!spec) return layer;
    return {
      ...layer,
      pos: spec.pos,
      fontSize: spec.fontSize,
      fontWeight: spec.fontWeight,
      offsetX: 0,
      offsetY: spec.offsetY,
      maxWidth: spec.maxWidth,
      fontPreset: spec.fontPreset ?? (field === "title" ? "poster" : "pretendard"),
      align: spec.align ?? (field === "programs" ? "left" : "center"),
      letterSpacing:
        spec.letterSpacing ??
        (field === "programs" || field === "date"
          ? 0
          : field === "title"
            ? 1
            : 0),
      lineHeight: field === "programs" ? 1.45 : layer.lineHeight,
    };
  });
}

/** Build canvas TextLayers from smart-form inputs (empty fields skipped). */
export function smartInputsToTextLayers(
  inputs: SmartInputValues,
  specs: FormToDesignLayerSpec[] = DEFAULT_SPECS
): TextLayer[] {
  const layers: TextLayer[] = [];
  for (const spec of specs) {
    const text = (inputs[spec.field] || "").trim();
    if (!text) continue;
    layers.push(
      createLayer({
        id: `form-${spec.field}`,
        text: formatFormFieldText(spec.field, text),
        pos: spec.pos,
        fontSize: spec.fontSize,
        fontWeight: spec.fontWeight,
        offsetX: 0,
        offsetY: spec.offsetY,
        maxWidth: spec.maxWidth,
        color: spec.color,
        fontPreset:
          spec.fontPreset ?? (spec.field === "title" ? "poster" : "pretendard"),
        align: spec.align ?? (spec.field === "programs" ? "left" : "center"),
        letterSpacing:
          spec.letterSpacing ??
          (spec.field === "programs" || spec.field === "date"
            ? 0
            : spec.field === "title"
              ? 1
              : 0),
        lineHeight: spec.field === "programs" ? 1.45 : 1.25,
      })
    );
  }
  return layers;
}

/** Live preview overlay model for Step 2 (HTML, not canvas paint). */
export type FormOverlayPreview = {
  date: string;
  title: string;
  subtitle: string;
  location: string;
  organizer: string;
  programs: string;
};

export function smartInputsToOverlayPreview(
  inputs: SmartInputValues
): FormOverlayPreview {
  return {
    date: inputs.date.trim(),
    title: inputs.title.trim(),
    subtitle: inputs.subtitle.trim(),
    location: inputs.location.trim(),
    organizer: inputs.organizer.trim(),
    programs: inputs.programs.trim(),
  };
}

export function hasFormOverlayCopy(preview: FormOverlayPreview): boolean {
  return Boolean(
    preview.date ||
      preview.title ||
      preview.subtitle ||
      preview.location ||
      preview.organizer ||
      preview.programs
  );
}
