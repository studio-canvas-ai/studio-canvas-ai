/**
 * Smart AI Layout & Auto-Composition Engine
 * Maps [규격 × 용도 × 장수 × 분야 × 입력 데이터] → per-page TextLayer composition.
 */

import {
  specsForFieldLayout,
  type FormToDesignLayerSpec,
} from "@/lib/ai/formToDesign";
import {
  fieldById,
  resolvePrintAspect,
  type BgPresetId,
  type FieldLayoutKind,
  type PrintCustomSize,
  type PrintFormatId,
  type PrintPageCount,
  type PrintUseId,
  type PrintWizardState,
  type SmartInputValues,
} from "@/lib/printWizardTypes";
import { createLayer, type TextLayer } from "@/lib/thumbnailStyles";
import { formatFormFieldText } from "@/lib/printWizardTextFormat";
import {
  editorSlotCount,
  padPageLayers,
  resizeIndependentPages,
  syncGlobalFieldsIntoPages,
} from "@/lib/printWizardTextLayers";

export type AutoLayoutContext = {
  formatId: PrintFormatId;
  useId: PrintUseId;
  pageCount: PrintPageCount;
  bgPresetId: BgPresetId | null;
  customSize: PrintCustomSize | null;
};

type SmartInputField = keyof SmartInputValues;

type FieldRole = "hero" | "supporting" | "meta" | "detail";

type DistributionStrategy =
  | "default"
  | "invitation-split"
  | "flyer-split"
  | "menu-split"
  | "seminar-spread"
  | "banner-wide"
  | "minimal"
  | "tri-fold"
  | "brochure-spread"
  | "detail-heavy"
  | "card-minimal"
  | "lookbook-minimal";

type UseLayoutProfile = {
  layoutKind: FieldLayoutKind;
  distribution: DistributionStrategy;
  /** Optional default 분야 when none selected. */
  defaultBgPresetId?: BgPresetId;
};

const FIELD_ROLES: Record<SmartInputField, FieldRole> = {
  title: "hero",
  subtitle: "supporting",
  date: "meta",
  location: "meta",
  organizer: "detail",
  programs: "detail",
};

const COVER_PRIORITY: SmartInputField[] = [
  "title",
  "subtitle",
  "date",
  "location",
];

const DETAIL_PRIORITY: SmartInputField[] = ["programs", "organizer"];

/** 용도 — layout tone + page distribution strategy. */
const USE_PROFILES: Record<PrintUseId, UseLayoutProfile> = {
  banner: { layoutKind: "poster-bold", distribution: "banner-wide" },
  lookbook: { layoutKind: "corporate", distribution: "lookbook-minimal" },
  calendar: { layoutKind: "formal", distribution: "default" },
  sns: { layoutKind: "product", distribution: "flyer-split" },
  poster: { layoutKind: "poster-bold", distribution: "flyer-split" },
  "id-photo": { layoutKind: "formal", distribution: "minimal" },
  "concept-photo": { layoutKind: "product", distribution: "lookbook-minimal" },
  pamphlet: { layoutKind: "seminar", distribution: "tri-fold" },
  menu: { layoutKind: "menu", distribution: "menu-split" },
  flyer: { layoutKind: "poster-bold", distribution: "flyer-split" },
  "hanging-banner": {
    layoutKind: "poster-bold",
    distribution: "banner-wide",
  },
  brochure: { layoutKind: "corporate", distribution: "brochure-spread" },
  leaflet: { layoutKind: "festival", distribution: "flyer-split" },
  "business-card": {
    layoutKind: "corporate",
    distribution: "card-minimal",
  },
  "card-news": { layoutKind: "product", distribution: "flyer-split" },
  "detail-page": { layoutKind: "product", distribution: "detail-heavy" },
  presentation: { layoutKind: "seminar", distribution: "seminar-spread" },
  invitation: {
    layoutKind: "invitation",
    distribution: "invitation-split",
    defaultBgPresetId: "wedding-invitation",
  },
};

/** Physical trim sizes (mm) for bleed/safe calculations. */
const FORMAT_MM: Partial<
  Record<PrintFormatId, { widthMm: number; heightMm: number }>
> = {
  a2: { widthMm: 420, heightMm: 594 },
  a3: { widthMm: 297, heightMm: 420 },
  a4: { widthMm: 210, heightMm: 297 },
  "id-photo": { widthMm: 35, heightMm: 45 },
  "invite-square-150": { widthMm: 150, heightMm: 150 },
  "invite-postcard-100x150": { widthMm: 100, heightMm: 150 },
};

const BLEED_MM = 3;
const SAFE_MM = 5;

function filledFields(inputs: SmartInputValues): SmartInputField[] {
  return (Object.keys(inputs) as SmartInputField[]).filter(
    (key) => inputs[key].trim().length > 0
  );
}

function fieldsByRole(
  fields: SmartInputField[],
  role: FieldRole
): SmartInputField[] {
  return fields.filter((f) => FIELD_ROLES[f] === role);
}

function pickOrdered(
  fields: SmartInputField[],
  order: SmartInputField[]
): SmartInputField[] {
  return order.filter((f) => fields.includes(f));
}

function chunkEvenly<T>(items: T[], buckets: number): T[][] {
  if (buckets <= 0) return [];
  const out: T[][] = Array.from({ length: buckets }, () => []);
  items.forEach((item, index) => {
    out[index % buckets].push(item);
  });
  return out;
}

function distributeFields(
  fields: SmartInputField[],
  pageCount: PrintPageCount,
  strategy: DistributionStrategy
): SmartInputField[][] {
  const pages: SmartInputField[][] = Array.from(
    { length: pageCount },
    () => []
  );
  if (!fields.length) return pages;

  if (pageCount === 2) {
    const cover = pickOrdered(fields, [
      "title",
      "subtitle",
      "date",
      "location",
    ]);
    const inner = fields.filter((f) => !cover.includes(f));
    pages[0] = cover;
    pages[1] = inner;
    return pages;
  }

  if (pageCount === 3) {
    pages[0] = pickOrdered(fields, ["title", "subtitle"]);
    pages[1] = pickOrdered(fields, ["date", "location"]);
    pages[2] = pickOrdered(fields, ["programs", "organizer"]);
    const assigned = new Set(pages.flat());
    const missing = fields.filter((f) => !assigned.has(f));
    if (missing.length) pages[2] = [...pages[2], ...missing];
    return pages;
  }

  if (pageCount === 1) {
    pages[0] = [...fields];
    return pages;
  }

  const hero = pickOrdered(fields, COVER_PRIORITY);
  const detail = pickOrdered(fields, DETAIL_PRIORITY);
  const heroSet = new Set(hero);
  const detailSet = new Set(detail);

  switch (strategy) {
    case "minimal":
    case "card-minimal":
    case "lookbook-minimal":
      pages[0] = fields.slice(0, Math.min(3, fields.length));
      if (pageCount > 1) {
        pages[1] = fields.slice(pages[0].length);
      }
      break;

    case "banner-wide":
      pages[0] = pickOrdered(fields, ["title", "subtitle", "date", "location"]);
      for (let i = 1; i < pageCount; i++) {
        pages[i] = detail.filter((f) => !pages[0].includes(f));
      }
      break;

    case "invitation-split":
    case "flyer-split":
      pages[0] = hero;
      pages[1] = detail;
      for (let i = 2; i < pageCount; i++) {
        pages[i] = chunkEvenly(
          fields.filter((f) => !heroSet.has(f) && !detailSet.has(f)),
          pageCount - 2
        )[i - 2] ?? [];
      }
      break;

    case "menu-split":
      pages[0] = pickOrdered(fields, ["title", "subtitle", "location"]);
      pages[1] = pickOrdered(fields, ["programs", "date", "organizer"]);
      for (let i = 2; i < pageCount; i++) {
        pages[i] = detail;
      }
      break;

    case "detail-heavy":
      pages[0] = pickOrdered(fields, ["title", "subtitle"]);
      pages[1] = pickOrdered(fields, ["programs", "organizer", "location"]);
      for (let i = 2; i < pageCount; i++) {
        pages[i] = pickOrdered(fields, ["date", "organizer", "programs"]);
      }
      break;

    case "seminar-spread":
    case "brochure-spread":
    case "tri-fold": {
      pages[0] = fieldsByRole(fields, "hero").concat(
        fieldsByRole(fields, "supporting")
      );
      pages[1] = fieldsByRole(fields, "meta");
      const remaining = fields.filter(
        (f) => !pages[0].includes(f) && !pages[1].includes(f)
      );
      const tailBuckets = chunkEvenly(remaining, Math.max(1, pageCount - 2));
      for (let i = 2; i < pageCount; i++) {
        pages[i] = tailBuckets[i - 2] ?? [];
      }
      break;
    }

    default: {
      pages[0] = hero.concat(fieldsByRole(fields, "meta"));
      const rest = fields.filter((f) => !pages[0].includes(f));
      const tail = chunkEvenly(rest, pageCount - 1);
      for (let i = 1; i < pageCount; i++) {
        pages[i] = tail[i - 1] ?? [];
      }
      break;
    }
  }

  const assigned = new Set(pages.flat());
  const missing = fields.filter((f) => !assigned.has(f));
  if (missing.length) {
    pages[0] = [...pages[0], ...missing];
  }

  return pages;
}

/** Resolve visual layout kind — 분야 > 용도 > default. */
export function resolveLayoutKind(ctx: AutoLayoutContext): FieldLayoutKind {
  if (ctx.useId === "invitation") return "invitation";

  const fieldPreset = ctx.bgPresetId ? fieldById(ctx.bgPresetId) : null;
  if (fieldPreset?.layout) return fieldPreset.layout;
  if (fieldPreset?.groupId === "wedding") return "wedding";

  const useProfile = USE_PROFILES[ctx.useId];
  return useProfile?.layoutKind ?? "poster-bold";
}

export function resolveUseProfile(useId: PrintUseId): UseLayoutProfile {
  return USE_PROFILES[useId] ?? USE_PROFILES.flyer;
}

/** Format-aware safe margin + font scale for print trim sizes. */
export function resolveFormatMetrics(
  formatId: PrintFormatId,
  customSize: PrintCustomSize | null | undefined
): {
  widthMm: number;
  heightMm: number;
  aspect: number;
  safeMarginPct: number;
  fontScale: number;
} {
  const aspect = resolvePrintAspect(formatId, customSize);
  let widthMm = 210;
  let heightMm = 297;

  const known = FORMAT_MM[formatId];
  if (known) {
    widthMm = known.widthMm;
    heightMm = known.heightMm;
  } else if (formatId === "free" && customSize) {
    const toMm = customSize.unit === "cm" ? 10 : 25.4;
    widthMm = customSize.width * toMm;
    heightMm = customSize.height * toMm;
  } else {
    const shortMm = 210;
    if (aspect >= 1) {
      widthMm = shortMm * aspect;
      heightMm = shortMm;
    } else {
      widthMm = shortMm;
      heightMm = shortMm / aspect;
    }
  }

  const shortEdge = Math.min(widthMm, heightMm);
  const safeMarginPct = Math.min(
    0.12,
    Math.max(0.04, SAFE_MM / shortEdge)
  );
  const fontScale = Math.min(1.15, Math.max(0.55, shortEdge / 210));

  return { widthMm, heightMm, aspect, safeMarginPct, fontScale };
}

/** Shrink maxWidth / nudge offsets so text stays inside the print safe zone. */
export function applyFormatSafeConstraints(
  specs: FormToDesignLayerSpec[],
  formatId: PrintFormatId,
  customSize: PrintCustomSize | null | undefined
): FormToDesignLayerSpec[] {
  const { safeMarginPct, fontScale, aspect } = resolveFormatMetrics(
    formatId,
    customSize
  );
  const maxWidth = Math.max(0.55, 1 - safeMarginPct * 2.2);
  const isWide = aspect > 1.35;
  const isTall = aspect < 0.72;

  return specs.map((spec) => {
    const next: FormToDesignLayerSpec = {
      ...spec,
      fontSize: Math.max(12, Math.round(spec.fontSize * fontScale)),
      maxWidth: Math.min(spec.maxWidth, maxWidth),
    };

    if (isWide && spec.field === "title") {
      next.offsetY = (spec.offsetY ?? 0) - 0.04;
      next.maxWidth = Math.min(next.maxWidth, 0.82);
    }
    if (isTall && spec.field === "programs") {
      next.pos = "center";
      next.offsetY = 0.08;
      next.align = "center";
    }
    if (formatId === "invite-square-150" || formatId === "invite-postcard-100x150") {
      next.maxWidth = Math.min(next.maxWidth, 0.72);
    }

    return next;
  });
}

type PageRole = "cover" | "detail" | "inner";

function pageRole(pageIndex: number, pageCount: number): PageRole {
  if (pageIndex === 0) return "cover";
  if (pageCount === 2 && pageIndex === 1) return "detail";
  if (pageIndex === pageCount - 1 && pageCount > 2) return "detail";
  return "inner";
}

/** Per-page positional tuning — golden-ratio hero cluster on cover, list flow on detail. */
function applyPageRoleToSpec(
  spec: FormToDesignLayerSpec,
  role: PageRole
): FormToDesignLayerSpec {
  const next = { ...spec };

  if (role === "cover") {
    if (spec.field === "title") {
      next.pos = "center";
      next.offsetY = -0.12;
    } else if (spec.field === "subtitle") {
      next.pos = "center";
      next.offsetY = 0.02;
    } else if (spec.field === "date" || spec.field === "location") {
      next.pos = spec.field === "date" ? "top" : "bottom";
      next.offsetY = spec.field === "date" ? 0.04 : -0.1;
    }
    return next;
  }

  if (role === "detail" || role === "inner") {
    if (spec.field === "programs") {
      next.pos = "center";
      next.offsetY = -0.08;
      next.align = "left";
      next.maxWidth = Math.min(next.maxWidth, 0.88);
      next.fontSize = Math.max(14, Math.round(spec.fontSize * 0.9));
      next.letterSpacing = 0;
    } else if (spec.field === "organizer") {
      next.pos = "center";
      next.offsetY = 0.12;
      next.fontSize = Math.max(13, Math.round(spec.fontSize * 0.88));
    } else if (spec.field === "date" || spec.field === "location") {
      next.pos = "center";
      next.offsetY = spec.field === "date" ? -0.02 : 0.04;
      next.fontSize = Math.max(13, Math.round(spec.fontSize * 0.9));
    }
    return next;
  }

  if (spec.field === "title" || spec.field === "subtitle") {
    next.pos = "center";
  }
  return next;
}

function staggerLayersOnPage(
  layers: TextLayer[],
  role: PageRole
): TextLayer[] {
  if (layers.length <= 1 || role === "cover") return layers;

  const order: SmartInputField[] = [
    "programs",
    "organizer",
    "date",
    "location",
    "subtitle",
    "title",
  ];
  const sorted = [...layers].sort((a, b) => {
    const fa = a.id.slice(5) as SmartInputField;
    const fb = b.id.slice(5) as SmartInputField;
    return order.indexOf(fa) - order.indexOf(fb);
  });

  const startY = role === "detail" ? -0.18 : -0.12;
  const gap = 0.13;
  return sorted.map((layer, index) => ({
    ...layer,
    pos: "center" as const,
    offsetY: startY + index * gap,
    align:
      layer.id === "form-programs"
        ? ("left" as const)
        : layer.align ?? "center",
  }));
}

function layerFromSpec(
  spec: FormToDesignLayerSpec,
  text: string
): TextLayer {
  return createLayer({
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
      spec.fontPreset ??
      (spec.field === "title" ? "poster" : "pretendard"),
    align: spec.align ?? (spec.field === "programs" ? "left" : "center"),
    letterSpacing:
      spec.letterSpacing ??
      (spec.field === "programs" || spec.field === "date"
        ? 0
        : spec.field === "title"
          ? 1
          : 0),
    lineHeight: spec.field === "programs" ? 1.45 : 1.25,
  });
}

function findFormLayer(
  pages: TextLayer[][] | undefined,
  field: SmartInputField
): { pageIndex: number; layer: TextLayer } | null {
  if (!pages) return null;
  const id = `form-${field}`;
  for (let i = 0; i < pages.length; i++) {
    const layer = pages[i]?.find((l) => l.id === id);
    if (layer) return { pageIndex: i, layer };
  }
  return null;
}

/** Core composition — distributes fields across pages with format-safe specs. */
export function composeAutoLayoutPages(
  inputs: SmartInputValues,
  ctx: AutoLayoutContext,
  prevPages?: TextLayer[][]
): TextLayer[][] {
  const layoutKind = resolveLayoutKind(ctx);
  const profile = resolveUseProfile(ctx.useId);
  const baseSpecs = applyFormatSafeConstraints(
    specsForFieldLayout(layoutKind),
    ctx.formatId,
    ctx.customSize
  );
  const specMap = new Map(baseSpecs.map((s) => [s.field, s]));

  const active = filledFields(inputs);
  const distribution = distributeFields(
    active,
    ctx.pageCount,
    profile.distribution
  );

  const pages: TextLayer[][] = [];

  for (let pageIndex = 0; pageIndex < ctx.pageCount; pageIndex++) {
    const role = pageRole(pageIndex, ctx.pageCount);
    const pageFields = distribution[pageIndex] ?? [];
    const prevPageLayers = prevPages?.[pageIndex] ?? [];
    const layers: TextLayer[] = [];

    for (const field of pageFields) {
      const text = inputs[field].trim();
      if (!text) continue;

      const baseSpec = specMap.get(field);
      if (!baseSpec) continue;
      const spec = applyPageRoleToSpec(baseSpec, role);
      const existing = findFormLayer(prevPages, field);

      if (existing && existing.pageIndex === pageIndex) {
        layers.push({
          ...existing.layer,
          text: formatFormFieldText(field, text),
        });
      } else if (existing && existing.pageIndex !== pageIndex) {
        layers.push(layerFromSpec(spec, text));
      } else {
        layers.push(layerFromSpec(spec, text));
      }
    }

    for (const layer of prevPageLayers) {
      if (!layer.id.startsWith("form-")) {
        layers.push(layer);
      }
    }

    const hasUserLayout = prevPageLayers.some((l) => l.id.startsWith("form-"));
    pages.push(
      hasUserLayout ? layers : staggerLayersOnPage(layers, role)
    );
  }

  return pages;
}

export function resolveBackgroundKeyword(
  state: Pick<PrintWizardState, "bgKeyword" | "bgPresetId" | "mainPrompt">
): string {
  const typed = state.bgKeyword.trim();
  if (typed) return typed;
  const preset = state.bgPresetId ? fieldById(state.bgPresetId) : null;
  if (preset?.keyword) return preset.keyword;
  return state.mainPrompt.trim();
}

/** Apply full auto-layout when wizard specs change. */
export function applyAutoLayoutState(
  state: PrintWizardState,
  overrides: Partial<
    Pick<
      PrintWizardState,
      | "formatId"
      | "useId"
      | "pageCount"
      | "customSize"
      | "bgPresetId"
      | "inputs"
    >
  >
): PrintWizardState {
  const formatId = overrides.formatId ?? state.formatId;
  let useId = overrides.useId ?? state.useId;
  const pageCount = overrides.pageCount ?? state.pageCount;
  const inputs = overrides.inputs ?? state.inputs;
  let bgPresetId = overrides.bgPresetId ?? state.bgPresetId;

  let customSize = state.customSize;
  if (overrides.customSize !== undefined) {
    customSize = overrides.customSize;
  } else if (overrides.formatId !== undefined && formatId !== "free") {
    customSize = null;
  }

  if (
    formatId === "invite-square-150" ||
    formatId === "invite-postcard-100x150"
  ) {
    useId = "invitation";
  }

  if (overrides.bgPresetId !== undefined) {
    bgPresetId = overrides.bgPresetId;
  } else if (
    overrides.useId !== undefined &&
    !bgPresetId &&
    resolveUseProfile(useId).defaultBgPresetId
  ) {
    bgPresetId = resolveUseProfile(useId).defaultBgPresetId as BgPresetId;
  }

  const ctx: AutoLayoutContext = {
    formatId,
    useId,
    pageCount,
    bgPresetId,
    customSize,
  };

  const hasPages = state.textLayersByPage?.some((page) => page.length > 0);
  const textLayersByPage = hasPages
    ? resizeIndependentPages(state.textLayersByPage, editorSlotCount(pageCount))
    : resizeIndependentPages(
        composeAutoLayoutPages(inputs, ctx, undefined).map((page, index) =>
          padPageLayers(page, index)
        ),
        editorSlotCount(pageCount)
      );

  return {
    ...state,
    formatId,
    useId,
    pageCount,
    customSize,
    bgPresetId,
    inputs,
    textLayersByPage,
  };
}

/** Recompose only when inputs change — preserves user drag positions when possible. */
export function mergeInputsWithAutoLayout(
  state: PrintWizardState,
  inputs: SmartInputValues
): PrintWizardState {
  const ctx: AutoLayoutContext = {
    formatId: state.formatId,
    useId: state.useId,
    pageCount: state.pageCount,
    bgPresetId: state.bgPresetId,
    customSize: state.customSize,
  };

  const hasLayers = state.textLayersByPage?.some((page) => page.length > 0);
  const textLayersByPage = syncGlobalFieldsIntoPages(
    hasLayers
      ? resizeIndependentPages(
          state.textLayersByPage,
          editorSlotCount(state.pageCount)
        )
      : resizeIndependentPages(
          composeAutoLayoutPages(inputs, ctx, undefined).map((page, index) =>
            padPageLayers(page, index)
          ),
          editorSlotCount(state.pageCount)
        ),
    inputs
  );

  return {
    ...state,
    inputs,
    textLayersByPage,
  };
}

/** Export format physical info for blueprint overlay module. */
export function formatPhysicalSize(
  formatId: PrintFormatId,
  customSize: PrintCustomSize | null | undefined
): { widthMm: number; heightMm: number } {
  const { widthMm, heightMm } = resolveFormatMetrics(formatId, customSize);
  return { widthMm, heightMm };
}

export { BLEED_MM, SAFE_MM, FORMAT_MM, USE_PROFILES };
