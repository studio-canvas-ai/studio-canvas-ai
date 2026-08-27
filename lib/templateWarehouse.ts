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

export type Template01Card =
  | Template01SimpleCard
  | Template01StructuredCard
  | Template01NestedCard;

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
  }
): TextLayer {
  return createLayer({
    text,
    pos,
    layoutLocked: true,
    boxManual: true,
    manualX: geom.manualX,
    manualY: geom.manualY,
    boxW: geom.boxW,
    boxH: geom.boxH,
    maxWidth: geom.boxW,
    showBox: true,
    showBoxBorder: true,
    boxOpacity: 0.94,
    boxColor: geom.boxColor,
    color: geom.color ?? "white",
    fontSize: geom.fontSize,
    fontWeight: 700,
    align: "center",
    lineHeight: 1.25,
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

/** Expert Template 01 catalog — append entries; modal renders large scrollable grid cards. */
export const TEMPLATE_01_CARDS: Template01Card[] = [
  {
    id: 1,
    title: "환절기 면역력 관리 포스터",
    desc: "단면 · 세로형 9:16",
    layoutType: "simple",
    bg: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=400&q=80",
    text1: "잘 쉬고 있나요?",
    text2: "환절기 면역력을 높이자!",
    text3: "지금 바로 상담하세요 | 010 1234 5678",
  },
  {
    id: 2,
    title: "환절기 면역력 관리 포스터",
    desc: "단면 · 세로형 9:16 (구조형 레이아웃)",
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
    desc: "단면 · 전문가형 구조형 격자",
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
    desc: "단면 · 전문가형 다중박스 레이아웃",
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
];

export function template01CardToWarehouse(
  card: Template01Card
): WarehouseTemplate {
  if (isNestedTemplate01(card)) {
    return {
      id: `tpl-single-${card.id}`,
      tab: "single",
      title: card.title,
      subtitle: card.desc,
      formatId: "ratio-9-16",
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
      formatId: "ratio-9-16",
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
    formatId: "ratio-9-16",
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
