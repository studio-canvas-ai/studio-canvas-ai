/**
 * Screen 26 — Template Warehouse catalog + client events.
 * Additive only; does not alter existing canvas logic.
 */

import type { PrintFormatId, PrintPageCount } from "@/lib/printWizardTypes";
import type { TextLayer } from "@/lib/thumbnailStyles";
import { createLayer } from "@/lib/thumbnailStyles";

export const TEMPLATE_WAREHOUSE_OPEN_EVENT = "sca:open-template-warehouse";
export const TEMPLATE_WAREHOUSE_APPLY_EVENT = "sca:apply-warehouse-template";
export const TEMPLATE_WAREHOUSE_PENDING_KEY = "sca_warehouse_pending_v1";

export type WarehouseTabId =
  | "single"
  | "double"
  | "public"
  | "space4";

export type WarehouseTemplate = {
  id: string;
  tab: Exclude<WarehouseTabId, "space4">;
  title: string;
  subtitle: string;
  formatId: PrintFormatId;
  pageCount: PrintPageCount;
  /** Optional preview swatch (CSS). */
  thumbClass: string;
  /** Seed text layers per page (index 0 = page 1). */
  textLayersByPage: TextLayer[][];
  backgroundUrl?: string | null;
  /** Shown in public tab after PII masking. */
  maskedNote?: string;
};

/** Mask phone-like / contact strings for public promotion previews. */
export function maskTemplatePii(text: string): string {
  return text
    .replace(/\b010[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "010 **** ****")
    .replace(/\b01[1-9][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "01* **** ****")
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "***@***.***"
    );
}

function layer(
  text: string,
  pos: TextLayer["pos"],
  opts?: Partial<TextLayer>
): TextLayer {
  return createLayer({
    text,
    pos,
    fontSize: opts?.fontSize ?? 48,
    fontWeight: opts?.fontWeight ?? 700,
    color: opts?.color ?? "inkBlack",
    align: opts?.align ?? "center",
    maxWidth: opts?.maxWidth ?? 0.86,
    ...opts,
  });
}

/**
 * Template 01 (단면) card seed — append more entries; modal maps each to a large grid card.
 * Click → applyWarehouseTemplate → Screen 26 (existing apply path: bg + text layers).
 */
export type Template01SimpleCard = {
  id: number;
  title: string;
  desc: string;
  layoutType?: "simple";
  bg: string;
  text1: string;
  text2: string;
  text3: string;
};

export type Template01StructuredCard = {
  id: number;
  title: string;
  desc: string;
  layoutType: "structured-grid";
  headerText: string;
  gridTexts: string[];
  footerText: string;
};

export type Template01NestedSubBox = {
  title: string;
  items?: string[];
  infoLines?: string[];
};

export type Template01NestedCard = {
  id: number;
  title: string;
  desc: string;
  layoutType: "nested-boxes";
  badgeText: string;
  mainTitle: string;
  subBoxes: Template01NestedSubBox[];
  footerText: string;
};

export type Template01ModularTextBlock = {
  id: string;
  type:
    | "hero-title"
    | "hero-sub"
    | "circle-1"
    | "circle-2"
    | "circle-3"
    | "card-l-title"
    | "card-l-support"
    | "card-l-amount"
    | "card-r-title"
    | "card-r-support"
    | "card-r-amount"
    | "step-1"
    | "step-2"
    | "step-3"
    | "step-4"
    | "footer"
    | string;
  text: string;
};

export type Template01ComparisonCard = {
  title: string;
  supportText?: string;
  amount?: string;
};

export type Template01ModularCard = {
  id: number;
  title: string;
  desc: string;
  layoutType: "modular-block-system";
  aspectRatio?: "A4";
  /** Legacy flat block list — used when structured fields are omitted. */
  textBlocks?: Template01ModularTextBlock[];
  /** Structured module schema (preferred for new templates). */
  heroBanner?: { title: string; subtitle?: string };
  circularItems?: string[];
  comparisonCards?: Template01ComparisonCard[];
  stepFlow?: string[];
  footerText?: string;
};

export type Template01Card =
  | Template01SimpleCard
  | Template01StructuredCard
  | Template01NestedCard
  | Template01ModularCard;

/** Template 01 warehouse + canvas use fixed A4 portrait (210∶297 ≈ 1∶1.414). */
export const TEMPLATE_01_A4_ASPECT = 210 / 297;
export const TEMPLATE_01_FORMAT_ID = "a4" as const;

export function isStructuredTemplate01(
  card: Template01Card
): card is Template01StructuredCard {
  return card.layoutType === "structured-grid";
}

export function isNestedTemplate01(
  card: Template01Card
): card is Template01NestedCard {
  return card.layoutType === "nested-boxes";
}

export function isModularTemplate01(
  card: Template01Card
): card is Template01ModularCard {
  return card.layoutType === "modular-block-system";
}

/** Persist Template 01 cards removed via warehouse trash button. */
export const TEMPLATE_01_REMOVED_KEY = "sca_warehouse_tpl01_removed_v1";

export function loadRemovedTemplate01Ids(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEMPLATE_01_REMOVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

export function saveRemovedTemplate01Ids(ids: number[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEMPLATE_01_REMOVED_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

/** Soft clinic-style page fill for structured-grid templates (no Screen 26 changes). */
export function buildStructuredGridBackgroundDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F0FDFA"/>
      <stop offset="55%" stop-color="#ECFDF5"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1600" fill="url(#page)"/>
  <rect x="36" y="36" width="828" height="1528" rx="28" fill="none" stroke="#99F6E4" stroke-width="3"/>
  <circle cx="780" cy="220" r="120" fill="#CCFBF1" opacity="0.55"/>
  <circle cx="120" cy="1280" r="160" fill="#A7F3D0" opacity="0.35"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Medical / public-info page fill for nested-box templates. */
export function buildNestedBoxesBackgroundDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#EFF6FF"/>
      <stop offset="50%" stop-color="#F8FAFC"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1600" fill="url(#page)"/>
  <rect x="40" y="40" width="820" height="1520" rx="24" fill="none" stroke="#BFDBFE" stroke-width="3"/>
  <rect x="64" y="300" width="772" height="980" rx="20" fill="none" stroke="#93C5FD" stroke-width="2" stroke-dasharray="8 6"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Hearing-aid / modular public poster page fill (A4 210×297) — navy & gold pro palette. */
export function buildModularBlockBackgroundDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="40%" stop-color="#F1F5F9"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#C9A227" stop-opacity="0"/>
      <stop offset="50%" stop-color="#D4AF37" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#C9A227" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="794" height="1123" fill="url(#page)"/>
  <rect x="24" y="24" width="746" height="1075" rx="20" fill="none" stroke="#CBD5E1" stroke-width="2"/>
  <rect x="24" y="24" width="746" height="6" rx="3" fill="url(#gold)"/>
  <rect x="48" y="72" width="698" height="140" rx="14" fill="#0F172A" opacity="0.06"/>
  <circle cx="132" cy="340" r="52" fill="#F8FAFC" stroke="#C9A227" stroke-width="2" opacity="0.9"/>
  <circle cx="397" cy="340" r="52" fill="#F8FAFC" stroke="#C9A227" stroke-width="2" opacity="0.85"/>
  <circle cx="662" cy="340" r="52" fill="#F8FAFC" stroke="#C9A227" stroke-width="2" opacity="0.8"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Normalize structured modular data → independent text blocks for the canvas engine.
 * Supports legacy textBlocks-only cards and heroBanner / comparisonCards schemas.
 */
export function resolveModularCardBlocks(
  card: Template01ModularCard
): Template01ModularTextBlock[] {
  const hasStructured =
    Boolean(card.heroBanner) ||
    Boolean(card.circularItems?.length) ||
    Boolean(card.comparisonCards?.length) ||
    Boolean(card.stepFlow?.length) ||
    Boolean(card.footerText);

  if (!hasStructured && card.textBlocks?.length) {
    return card.textBlocks;
  }

  const blocks: Template01ModularTextBlock[] = [];

  if (card.heroBanner?.title) {
    blocks.push({
      id: `mod-${card.id}-hero-t`,
      type: "hero-title",
      text: card.heroBanner.title,
    });
    if (card.heroBanner.subtitle) {
      blocks.push({
        id: `mod-${card.id}-hero-s`,
        type: "hero-sub",
        text: card.heroBanner.subtitle,
      });
    }
  }

  (card.circularItems ?? []).slice(0, 6).forEach((text, index) => {
    blocks.push({
      id: `mod-${card.id}-circle-${index + 1}`,
      type: `circle-${index + 1}`,
      text,
    });
  });

  (card.comparisonCards ?? []).slice(0, 4).forEach((cmp, index) => {
    const side = index === 0 ? "l" : index === 1 ? "r" : `${index}`;
    const prefix = typeof side === "string" && side.length === 1 ? `card-${side}` : `card-${side}`;
    blocks.push({
      id: `mod-${card.id}-cmp-${index}-t`,
      type: `${prefix}-title`,
      text: cmp.title,
    });
    if (cmp.supportText) {
      blocks.push({
        id: `mod-${card.id}-cmp-${index}-s`,
        type: `${prefix}-support`,
        text: cmp.supportText,
      });
    }
    if (cmp.amount) {
      blocks.push({
        id: `mod-${card.id}-cmp-${index}-a`,
        type: `${prefix}-amount`,
        text: cmp.amount,
      });
    }
  });

  (card.stepFlow ?? []).slice(0, 8).forEach((text, index) => {
    blocks.push({
      id: `mod-${card.id}-step-${index + 1}`,
      type: `step-${index + 1}`,
      text,
    });
  });

  if (card.footerText) {
    blocks.push({
      id: `mod-${card.id}-footer`,
      type: "footer",
      text: card.footerText,
    });
  }

  if (blocks.length) return blocks;
  return card.textBlocks ?? [];
}

function formatNestedSubBoxBody(box: Template01NestedSubBox): string {
  if (box.items?.length) {
    return box.items.map((item) => `• ${item}`).join("\n");
  }
  if (box.infoLines?.length) {
    return box.infoLines.join("\n");
  }
  return "";
}

function boxedLayer(
  text: string,
  pos: TextLayer["pos"],
  geom: {
    manualX: number;
    manualY: number;
    boxW: number;
    boxH: number;
    fontSize: number;
    boxColor: string;
    color?: TextLayer["color"];
    boxOpacity?: number;
    align?: TextLayer["align"];
    lineHeight?: number;
    fontWeight?: number;
  }
): TextLayer {
  const { color, boxOpacity, align, lineHeight, fontWeight, ...boxGeom } = geom;
  return createLayer({
    text,
    pos,
    layoutLocked: true,
    boxManual: true,
    manualX: boxGeom.manualX,
    manualY: boxGeom.manualY,
    boxW: boxGeom.boxW,
    boxH: boxGeom.boxH,
    maxWidth: boxGeom.boxW,
    showBox: true,
    showBoxBorder: true,
    boxOpacity: boxOpacity ?? 0.94,
    boxColor: boxGeom.boxColor,
    color: color ?? "white",
    fontSize: boxGeom.fontSize,
    fontWeight: fontWeight ?? 700,
    align: align ?? "center",
    lineHeight: lineHeight ?? 1.25,
    fontPreset: "pretendard",
  });
}

/** Header banner + 2×3 info grid + footer contact — all layoutLocked boxes. */
export function buildStructuredGridTextLayers(
  card: Template01StructuredCard
): TextLayer[] {
  const margin = 0.05;
  const gap = 0.025;
  const cols = 3;
  const rows = 2;
  const contentW = 1 - margin * 2;
  const headerH = 0.11;
  const footerH = 0.1;
  const headerY = 0.045;
  const footerY = 1 - margin - footerH;
  const gridTop = headerY + headerH + 0.045;
  const gridBottom = footerY - 0.04;
  const gridH = Math.max(0.2, gridBottom - gridTop);
  const cellW = (contentW - gap * (cols - 1)) / cols;
  const cellH = (gridH - gap * (rows - 1)) / rows;
  const cells = (card.gridTexts.length ? card.gridTexts : []).slice(0, cols * rows);
  while (cells.length < cols * rows) {
    cells.push(`항목 ${cells.length + 1}`);
  }

  const layers: TextLayer[] = [
    boxedLayer(card.headerText, "top", {
      manualX: margin,
      manualY: headerY,
      boxW: contentW,
      boxH: headerH,
      fontSize: 36,
      boxColor: "#0F766E",
      color: "white",
    }),
  ];

  cells.forEach((label, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    layers.push(
      boxedLayer(label, "center", {
        manualX: margin + col * (cellW + gap),
        manualY: gridTop + row * (cellH + gap),
        boxW: cellW,
        boxH: cellH,
        fontSize: 26,
        boxColor: "#FFFFFF",
        color: "inkBlack",
      })
    );
  });

  layers.push(
    boxedLayer(card.footerText, "bottom", {
      manualX: margin,
      manualY: footerY,
      boxW: contentW,
      boxH: footerH,
      fontSize: 26,
      boxColor: "#134E4A",
      color: "white",
    })
  );

  return layers;
}

/** Badge + title banner + side-by-side nested sub-boxes + footer contact bar. */
export function buildNestedBoxesTextLayers(
  card: Template01NestedCard
): TextLayer[] {
  const margin = 0.05;
  const gap = 0.025;
  const contentW = 1 - margin * 2;
  const badgeW = 0.62;
  const badgeH = 0.055;
  const badgeX = margin + (contentW - badgeW) / 2;
  const badgeY = 0.042;
  const titleY = badgeY + badgeH + 0.028;
  const titleH = 0.105;
  const subTop = titleY + titleH + 0.035;
  const footerH = 0.095;
  const footerY = 1 - margin - footerH;
  const subH = Math.max(0.36, footerY - subTop - 0.04);
  const subW = (contentW - gap) / 2;
  const subBoxes = card.subBoxes.slice(0, 2);
  while (subBoxes.length < 2) {
    subBoxes.push({ title: `안내 ${subBoxes.length + 1}`, items: [] });
  }

  const layers: TextLayer[] = [
    boxedLayer(card.badgeText, "top", {
      manualX: badgeX,
      manualY: badgeY,
      boxW: badgeW,
      boxH: badgeH,
      fontSize: 22,
      boxColor: "#1D4ED8",
      color: "white",
    }),
    boxedLayer(card.mainTitle, "top", {
      manualX: margin,
      manualY: titleY,
      boxW: contentW,
      boxH: titleH,
      fontSize: 38,
      boxColor: "#1E3A8A",
      color: "white",
    }),
  ];

  subBoxes.forEach((box, index) => {
    const subX = margin + index * (subW + gap);
    const innerPad = 0.012;
    const headerH = 0.065;
    const bodyY = subTop + headerH + 0.018;
    const bodyH = subH - headerH - 0.03;

    layers.push(
      boxedLayer(" ", "center", {
        manualX: subX,
        manualY: subTop,
        boxW: subW,
        boxH: subH,
        fontSize: 16,
        boxColor: "#F8FAFC",
        color: "inkBlack",
      })
    );
    layers.push(
      boxedLayer(box.title, "center", {
        manualX: subX + innerPad,
        manualY: subTop + innerPad,
        boxW: subW - innerPad * 2,
        boxH: headerH,
        fontSize: 20,
        boxColor: "#DBEAFE",
        color: "deepBlue",
      })
    );
    layers.push(
      boxedLayer(formatNestedSubBoxBody(box), "center", {
        manualX: subX + innerPad,
        manualY: bodyY,
        boxW: subW - innerPad * 2,
        boxH: bodyH,
        fontSize: 19,
        boxColor: "#FFFFFF",
        boxOpacity: 0.88,
        color: "inkBlack",
        align: "left",
        lineHeight: 1.35,
      })
    );
  });

  layers.push(
    boxedLayer(card.footerText, "bottom", {
      manualX: margin,
      manualY: footerY,
      boxW: contentW,
      boxH: footerH,
      fontSize: 24,
      boxColor: "#0F172A",
      color: "white",
    })
  );

  return layers;
}

/**
 * Modular block system — one independent layoutLocked box per textBlock.
 * Screen 26 can move / edit / delete each box via existing layer tools (no Screen 26 edits).
 */
export function buildModularBlockTextLayers(
  card: Template01ModularCard
): TextLayer[] {
  const margin = 0.055;
  const gap = 0.016;
  const contentW = 1 - margin * 2;
  const blocks = resolveModularCardBlocks(card);
  const layers: TextLayer[] = [];

  const NAVY = "#0F172A";
  const NAVY_MID = "#1E293B";
  const GOLD_LIGHT = "#F5E6B8";
  const GRAY_BG = "#F8FAFC";
  const GRAY_MID = "#E2E8F0";

  const byType = (type: string) => blocks.find((b) => b.type === type);

  const push = (
    block: Template01ModularTextBlock | undefined,
    geom: Parameters<typeof boxedLayer>[2] & { pos?: TextLayer["pos"] }
  ) => {
    if (!block?.text.trim()) return;
    const { pos = "center", ...rest } = geom;
    const layer = boxedLayer(block.text, pos, rest);
    layer.id = `tpl01-mod-${card.id}-${block.id}`;
    layers.push(layer);
  };

  const heroTitleY = 0.038;
  const heroTitleH = 0.085;
  push(byType("hero-title"), {
    pos: "top",
    manualX: margin,
    manualY: heroTitleY,
    boxW: contentW,
    boxH: heroTitleH,
    fontSize: 32,
    boxColor: NAVY,
    color: "white",
  });

  const heroSubY = heroTitleY + heroTitleH + gap;
  const heroSubH = 0.052;
  push(byType("hero-sub"), {
    pos: "top",
    manualX: margin,
    manualY: heroSubY,
    boxW: contentW,
    boxH: heroSubH,
    fontSize: 22,
    boxColor: GOLD_LIGHT,
    color: "inkBlack",
  });

  const circleBlocks = blocks.filter((b) => /^circle-\d+$/.test(b.type));
  const circleCount = Math.max(3, Math.min(6, circleBlocks.length || 3));
  const circleGap = 0.022;
  const circleW = (contentW - circleGap * (circleCount - 1)) / circleCount;
  const circleH = 0.095;
  const circleY = heroSubY + heroSubH + 0.026;
  circleBlocks.slice(0, circleCount).forEach((block, index) => {
    push(block, {
      manualX: margin + index * (circleW + circleGap),
      manualY: circleY,
      boxW: circleW,
      boxH: circleH,
      fontSize: 17,
      boxColor: "#FFFFFF",
      color: "inkBlack",
      lineHeight: 1.2,
    });
  });

  const hasSplitCards =
    Boolean(byType("card-l-support")) ||
    Boolean(byType("card-r-support")) ||
    Boolean(
      blocks.some(
        (b) => b.type.endsWith("-support") || b.type.endsWith("-amount")
      )
    );

  const cardGap = 0.022;
  const cardW = (contentW - cardGap) / 2;
  const cardY = circleY + circleH + 0.028;

  if (hasSplitCards) {
    const sides: Array<"l" | "r"> = ["l", "r"];
    sides.forEach((side, index) => {
      const cardX = margin + index * (cardW + cardGap);
      const titleH = 0.048;
      const supportH = 0.042;
      const amountH = 0.048;
      const frameH = titleH + supportH + amountH + gap * 2 + 0.012;

      layers.push(
        boxedLayer(" ", "center", {
          manualX: cardX,
          manualY: cardY,
          boxW: cardW,
          boxH: frameH,
          fontSize: 12,
          boxColor: GRAY_BG,
          color: "inkBlack",
          boxOpacity: 0.92,
        })
      );
      const frameLayer = layers[layers.length - 1]!;
      frameLayer.id = `tpl01-mod-${card.id}-frame-${side}`;
      frameLayer.layoutLocked = true;

      push(byType(`card-${side}-title`), {
        manualX: cardX + 0.008,
        manualY: cardY + 0.008,
        boxW: cardW - 0.016,
        boxH: titleH,
        fontSize: 17,
        boxColor: NAVY_MID,
        color: "white",
      });
      push(byType(`card-${side}-support`), {
        manualX: cardX + 0.008,
        manualY: cardY + 0.008 + titleH + gap,
        boxW: cardW - 0.016,
        boxH: supportH,
        fontSize: 15,
        boxColor: GRAY_MID,
        color: "inkBlack",
      });
      push(byType(`card-${side}-amount`), {
        manualX: cardX + 0.008,
        manualY: cardY + 0.008 + titleH + gap + supportH + gap,
        boxW: cardW - 0.016,
        boxH: amountH,
        fontSize: 20,
        boxColor: GOLD_LIGHT,
        color: "inkBlack",
        fontWeight: 800,
      });
    });
  } else {
    push(byType("card-l-title"), {
      manualX: margin,
      manualY: cardY,
      boxW: cardW,
      boxH: 0.13,
      fontSize: 16,
      boxColor: "#FFFFFF",
      color: "inkBlack",
      lineHeight: 1.3,
    });
    push(byType("card-r-title"), {
      manualX: margin + cardW + cardGap,
      manualY: cardY,
      boxW: cardW,
      boxH: 0.13,
      fontSize: 16,
      boxColor: "#FFFFFF",
      color: "inkBlack",
      lineHeight: 1.3,
    });
  }

  const cardBlockH = hasSplitCards ? 0.16 : 0.13;
  const stepBlocks = blocks.filter((b) => /^step-\d+$/.test(b.type));
  const stepH = 0.058;
  const stepY0 = cardY + cardBlockH + 0.026;
  stepBlocks.forEach((block, index) => {
    const stepIndex = Number(block.type.replace("step-", "")) || index + 1;
    push(block, {
      manualX: margin,
      manualY: stepY0 + index * (stepH + gap),
      boxW: contentW,
      boxH: stepH,
      fontSize: 17,
      boxColor: stepIndex % 2 === 1 ? GRAY_MID : GRAY_BG,
      color: "inkBlack",
      align: "left",
    });
  });

  const footerH = 0.078;
  const footerY = 1 - margin - footerH;
  push(byType("footer"), {
    pos: "bottom",
    manualX: margin,
    manualY: footerY,
    boxW: contentW,
    boxH: footerH,
    fontSize: 22,
    boxColor: NAVY,
    color: "white",
  });

  const known = new Set([
    "hero-title",
    "hero-sub",
    "card-l-title",
    "card-l-support",
    "card-l-amount",
    "card-r-title",
    "card-r-support",
    "card-r-amount",
    "footer",
    ...blocks
      .filter((b) => /^circle-\d+$/.test(b.type) || /^step-\d+$/.test(b.type))
      .map((b) => b.type),
  ]);
  const extras = blocks.filter((b) => !known.has(b.type));
  extras.forEach((block, index) => {
    push(block, {
      manualX: margin,
      manualY: Math.min(0.78, stepY0 + stepBlocks.length * (stepH + gap) + index * 0.065),
      boxW: contentW,
      boxH: 0.055,
      fontSize: 16,
      boxColor: GRAY_BG,
      color: "inkBlack",
    });
  });

  return layers;
}

/** Expert Template 01 catalog — append entries; modal renders large scrollable grid cards. */
export const TEMPLATE_01_CARDS: Template01Card[] = [
  {
    id: 1,
    title: "환절기 면역력 관리 포스터",
    desc: "단면 · A4 세로형",
    layoutType: "simple",
    bg: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=400&q=80",
    text1: "잘 쉬고 있나요?",
    text2: "환절기 면역력을 높이자!",
    text3: "지금 바로 상담하세요 | 010 1234 5678",
  },
  {
    id: 2,
    title: "환절기 면역력 관리 포스터",
    desc: "단면 · A4 구조형 레이아웃",
    layoutType: "structured-grid",
    headerText: "2090 환절기 건강관리 첫걸음",
    gridTexts: [
      "면역력 수칙 1",
      "면역력 수칙 2",
      "면역력 수칙 3",
      "손씻기·마스크",
      "실내 환기",
      "규칙적 운동",
    ],
    footerText: "문의 및 상담 안내 | 010 1234 5678",
  },
  {
    id: 3,
    title: "환절기 면역력 관리 포스터",
    desc: "단면 · A4 전문가형 구조형 격자",
    layoutType: "structured-grid",
    headerText: "2090 환절기 건강관리 첫걸음",
    gridTexts: [
      "면역력 수칙 1",
      "면역력 수칙 2",
      "면역력 수칙 3",
      "손씻기·마스크",
      "실내 환기",
      "규칙적 운동",
    ],
    footerText: "문의 및 상담 안내 | 010 1234 5678",
  },
  {
    id: 4,
    title: "성인 필수 예방접종 안내",
    desc: "단면 · A4 전문가형 다중박스 레이아웃",
    layoutType: "nested-boxes",
    badgeText: "18세 이상 성인 필수",
    mainTitle: "예방접종 안내",
    subBoxes: [
      {
        title: "백신 접종 항목",
        items: ["A형간염", "B형간염", "파상풍", "인플루엔자", "대상포진", "폐렴구균"],
      },
      {
        title: "이용 안내",
        infoLines: [
          "접종 시간: 평일 09:00 ~ 18:00",
          "문의 전화: 02-000-1234",
        ],
      },
    ],
    footerText: "미리미리 예방하세요 | 010 1234 5678",
  },
  {
    id: 5,
    title: "보청기 구입 지원금 안내 포스터",
    desc: "단면 · 모듈형 블록 시스템 (A4 고정)",
    layoutType: "modular-block-system",
    aspectRatio: "A4",
    textBlocks: [
      { id: "b1", type: "hero-title", text: "보청기 구입할 때 지원금 받자" },
      { id: "b2", type: "hero-sub", text: "정부 지원금 최대 혜택 안내" },
      { id: "b3", type: "circle-1", text: "귓속형 보청기" },
      { id: "b4", type: "circle-2", text: "오픈형 보청기" },
      { id: "b5", type: "circle-3", text: "프리미엄형" },
      {
        id: "b6",
        type: "card-l-title",
        text: "일반형 / 차상위 (정부 지원금 90% / 111만 9천원)",
      },
      {
        id: "b7",
        type: "card-r-title",
        text: "기초수급자 (정부 지원금 100% / 131만원)",
      },
      { id: "b8", type: "step-1", text: "01. 국민건강보험공단 등록" },
      { id: "b9", type: "step-2", text: "02. 보조기기 처방전 발급" },
      { id: "b10", type: "step-3", text: "03. 보청기 구입 및 검수" },
      { id: "b11", type: "step-4", text: "04. 지원금 청구 및 지급" },
      { id: "b12", type: "footer", text: "빠른 상담 | 1588-0000" },
    ],
  },
  {
    id: 6,
    title: "보청기 구입 지원금 안내 포스터",
    desc: "단면 · 모듈형 블록 시스템 (A4 · 전문가형)",
    layoutType: "modular-block-system",
    aspectRatio: "A4",
    heroBanner: {
      title: "보청기 구입할 때 지원금 받자",
      subtitle: "정부 지원금 최대 혜택 안내",
    },
    circularItems: ["귓속형 보청기", "오픈형 보청기", "프리미엄형"],
    comparisonCards: [
      {
        title: "일반형 / 차상위",
        supportText: "정부 지원금 90%",
        amount: "111만 9천원",
      },
      {
        title: "기초수급자",
        supportText: "정부 지원금 100%",
        amount: "131만원",
      },
    ],
    stepFlow: [
      "01. 국민건강보험공단 등록",
      "02. 보조기기 처방전 발급",
      "03. 보청기 구입 및 검수",
      "04. 지원금 청구 및 지급",
    ],
    footerText: "빠른 상담 | 1588-0000",
  },
];

export const TEMPLATE_01_CUSTOM_KEY = "sca_warehouse_tpl01_custom_v1";

export function isBuiltinTemplate01Id(id: number): boolean {
  return TEMPLATE_01_CARDS.some((card) => card.id === id);
}

export function loadCustomTemplate01Cards(): Template01Card[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEMPLATE_01_CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Template01Card[];
  } catch {
    return [];
  }
}

export function saveCustomTemplate01Cards(cards: Template01Card[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEMPLATE_01_CUSTOM_KEY, JSON.stringify(cards));
  } catch {
    /* ignore quota */
  }
}

/** Built-in (minus removed) + admin-duplicated custom cards. */
export function buildTemplate01WarehouseList(): Template01Card[] {
  const removed = new Set(loadRemovedTemplate01Ids());
  const builtIn = TEMPLATE_01_CARDS.filter((card) => !removed.has(card.id));
  const custom = loadCustomTemplate01Cards();
  return [...builtIn, ...custom];
}

export function nextTemplate01CardId(cards: Template01Card[]): number {
  return cards.reduce((max, card) => Math.max(max, card.id), 0) + 1;
}

export function cloneTemplate01Card(
  card: Template01Card,
  newId: number
): Template01Card {
  const copy = JSON.parse(JSON.stringify(card)) as Template01Card;
  copy.id = newId;
  copy.title = `${card.title} (복사)`;
  if (isModularTemplate01(copy) && copy.textBlocks?.length) {
    copy.textBlocks = copy.textBlocks.map((block, index) => ({
      ...block,
      id: `copy-${newId}-${index + 1}`,
    }));
  }
  return copy;
}

export function template01CardToWarehouse(
  card: Template01Card
): WarehouseTemplate {
  if (isModularTemplate01(card)) {
    return {
      id: `tpl-single-${card.id}`,
      tab: "single",
      title: card.title,
      subtitle: card.desc,
      formatId: TEMPLATE_01_FORMAT_ID,
      pageCount: 1,
      thumbClass: "bg-slate-900",
      backgroundUrl: buildModularBlockBackgroundDataUrl(),
      textLayersByPage: [buildModularBlockTextLayers(card)],
    };
  }
  if (isNestedTemplate01(card)) {
    return {
      id: `tpl-single-${card.id}`,
      tab: "single",
      title: card.title,
      subtitle: card.desc,
      formatId: TEMPLATE_01_FORMAT_ID,
      pageCount: 1,
      thumbClass: "bg-blue-900",
      backgroundUrl: buildNestedBoxesBackgroundDataUrl(),
      textLayersByPage: [buildNestedBoxesTextLayers(card)],
    };
  }
  if (isStructuredTemplate01(card)) {
    return {
      id: `tpl-single-${card.id}`,
      tab: "single",
      title: card.title,
      subtitle: card.desc,
      formatId: TEMPLATE_01_FORMAT_ID,
      pageCount: 1,
      thumbClass: "bg-teal-900",
      backgroundUrl: buildStructuredGridBackgroundDataUrl(),
      textLayersByPage: [buildStructuredGridTextLayers(card)],
    };
  }
  return {
    id: `tpl-single-${card.id}`,
    tab: "single",
    title: card.title,
    subtitle: card.desc,
    formatId: TEMPLATE_01_FORMAT_ID,
    pageCount: 1,
    thumbClass: "bg-slate-800",
    backgroundUrl: card.bg,
    textLayersByPage: [
      [
        layer(card.text1, "top", { fontSize: 48, color: "white" }),
        layer(card.text2, "center", { fontSize: 44, color: "white" }),
        layer(card.text3, "bottom", { fontSize: 28, color: "white" }),
      ],
    ],
  };
}

/** Built-in reference templates (Template 02 / 03). Template 01 uses TEMPLATE_01_CARDS. */
export const WAREHOUSE_TEMPLATES: WarehouseTemplate[] = [
  {
    id: "tpl-double-invite",
    tab: "double",
    title: "청첩장 · 양면",
    subtitle: "2면 · 표지 / 안내",
    formatId: "invite-postcard-100x150",
    pageCount: 2,
    thumbClass:
      "bg-[radial-gradient(ellipse_at_50%_40%,rgba(244,114,182,0.35),transparent_55%),linear-gradient(160deg,#4c0519,#1c1917)]",
    textLayersByPage: [
      [
        layer("우리 결혼합니다", "center", { fontSize: 40 }),
        layer("2026. 10. 10", "bottom", { fontSize: 28 }),
      ],
      [
        layer("예식 안내", "top", { fontSize: 36 }),
        layer("오후 2시 · 그랜드홀", "center", { fontSize: 32 }),
        layer("피로연 이어집니다", "bottom", { fontSize: 28 }),
      ],
    ],
  },
  {
    id: "tpl-multi-brochure",
    tab: "double",
    title: "브로슈어 · 4면",
    subtitle: "다페이지 · 소개 / 메뉴 / 연락",
    formatId: "a4",
    pageCount: 4,
    thumbClass:
      "bg-[radial-gradient(ellipse_at_20%_80%,rgba(16,185,129,0.35),transparent_50%),linear-gradient(135deg,#064e3b,#0f172a)]",
    textLayersByPage: [
      [layer("브랜드 소개", "center", { fontSize: 48, color: "white" })],
      [layer("시그니처 메뉴", "top", { fontSize: 40, color: "white" })],
      [layer("이용 안내", "center", { fontSize: 40, color: "white" })],
      [layer("찾아오시는 길", "center", { fontSize: 36, color: "white" })],
    ],
  },
  {
    id: "tpl-public-cafe",
    tab: "public",
    title: "카페 오픈 · 우수 승격",
    subtitle: "공개 · 연락처 마스킹 적용",
    formatId: "ratio-4-5",
    pageCount: 1,
    thumbClass:
      "bg-[radial-gradient(ellipse_at_40%_30%,rgba(253,186,116,0.4),transparent_55%),linear-gradient(160deg,#7c2d12,#1c1917)]",
    maskedNote: "연락처 010 **** **** · 이메일 ***@***.***",
    textLayersByPage: [
      [
        layer("카페 오픈 이벤트", "top", { fontSize: 44 }),
        layer("아메리카노 1+1", "center", { fontSize: 40 }),
        layer("문의 010 **** ****", "bottom", { fontSize: 28 }),
      ],
    ],
  },
  {
    id: "tpl-public-academy",
    tab: "public",
    title: "학원 모집 · 우수 승격",
    subtitle: "공개 · 개인정보 검수 완료",
    formatId: "a4",
    pageCount: 2,
    thumbClass:
      "bg-[radial-gradient(ellipse_at_60%_20%,rgba(96,165,250,0.4),transparent_50%),linear-gradient(160deg,#1e3a8a,#0f172a)]",
    maskedNote: "전화 010 **** **** 마스킹",
    textLayersByPage: [
      [
        layer("여름 특강 모집", "center", { fontSize: 48, color: "white" }),
        layer("조기 등록 할인", "bottom", { fontSize: 32, color: "white" }),
      ],
      [
        layer("커리큘럼 안내", "top", { fontSize: 40, color: "white" }),
        layer("상담 010 **** ****", "bottom", { fontSize: 28, color: "white" }),
      ],
    ],
  },
];

function cloneTemplatePages(
  pages: TextLayer[][],
  maskPii: boolean
): TextLayer[][] {
  return pages.map((page) =>
    page.map((l) => ({
      ...l,
      text: maskPii ? maskTemplatePii(l.text) : l.text,
      ranges: l.ranges?.map((r) => ({ ...r })) ?? [],
    }))
  );
}

export function templatesForTab(
  tab: Exclude<WarehouseTabId, "space4">
): WarehouseTemplate[] {
  if (tab === "single") {
    return TEMPLATE_01_CARDS.map(template01CardToWarehouse).map((t) => ({
      ...t,
      textLayersByPage: cloneTemplatePages(t.textLayersByPage, false),
    }));
  }
  const maskPii = tab === "public";
  return WAREHOUSE_TEMPLATES.filter((t) => t.tab === tab).map((t) => ({
    ...t,
    textLayersByPage: cloneTemplatePages(t.textLayersByPage, maskPii),
  }));
}

export function openTemplateWarehouse() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TEMPLATE_WAREHOUSE_OPEN_EVENT));
}

export function stashPendingWarehouseTemplate(template: WarehouseTemplate) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      TEMPLATE_WAREHOUSE_PENDING_KEY,
      JSON.stringify(template)
    );
  } catch {
    /* ignore quota */
  }
}

export function consumePendingWarehouseTemplate(): WarehouseTemplate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TEMPLATE_WAREHOUSE_PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(TEMPLATE_WAREHOUSE_PENDING_KEY);
    return JSON.parse(raw) as WarehouseTemplate;
  } catch {
    return null;
  }
}

export function applyWarehouseTemplate(template: WarehouseTemplate) {
  if (typeof window === "undefined") return;
  stashPendingWarehouseTemplate(template);
  window.dispatchEvent(
    new CustomEvent(TEMPLATE_WAREHOUSE_APPLY_EVENT, { detail: template })
  );
}
