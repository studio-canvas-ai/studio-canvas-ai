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
 * Click → applyWarehouseTemplate → Screen 26 loads bg + text1/2/3 (existing apply path).
 */
export type Template01Card = {
  id: number;
  title: string;
  desc: string;
  bg: string;
  text1: string;
  text2: string;
  text3: string;
};

export const TEMPLATE_01_CARDS: Template01Card[] = [
  {
    id: 1,
    title: "환절기 면역력 관리 포스터",
    desc: "단면 · 세로형 9:16",
    bg: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=400&q=80",
    text1: "잘 쉬고 있나요?",
    text2: "환절기 면역력을 높이자!",
    text3: "지금 바로 상담하세요 | 010 1234 5678",
  },
];

export function template01CardToWarehouse(
  card: Template01Card
): WarehouseTemplate {
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
