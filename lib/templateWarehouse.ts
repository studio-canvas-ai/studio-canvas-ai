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

/** Built-in reference templates (client catalog). */
export const WAREHOUSE_TEMPLATES: WarehouseTemplate[] = [
  {
    id: "tpl-single-flyer-a4",
    tab: "single",
    title: "A4 전단 · 봄 프로모션",
    subtitle: "단면 · 상단 타이틀 + 하단 CTA",
    formatId: "a4",
    pageCount: 1,
    thumbClass:
      "bg-[radial-gradient(ellipse_at_30%_20%,rgba(251,191,36,0.45),transparent_55%),linear-gradient(160deg,#1e293b,#0f172a)]",
    textLayersByPage: [
      [
        layer("봄맞이 특별전", "top", { fontSize: 56 }),
        layer("전 품목 20% 할인", "center", { fontSize: 40 }),
        layer("지금 바로 방문하세요", "bottom", { fontSize: 32 }),
      ],
    ],
  },
  {
    id: "tpl-single-poster-916",
    tab: "single",
    title: "9:16 포스터 · 공연 안내",
    subtitle: "단면 · 세로형 이벤트",
    formatId: "ratio-9-16",
    pageCount: 1,
    thumbClass:
      "bg-[radial-gradient(ellipse_at_70%_30%,rgba(168,85,247,0.4),transparent_50%),linear-gradient(180deg,#312e81,#0f172a)]",
    textLayersByPage: [
      [
        layer("LIVE CONCERT", "top", { fontSize: 44, color: "white" }),
        layer("오늘 밤 8시", "center", { fontSize: 52, color: "white" }),
        layer("입장권 현장 판매", "bottom", { fontSize: 28, color: "white" }),
      ],
    ],
  },
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

export function templatesForTab(
  tab: Exclude<WarehouseTabId, "space4">
): WarehouseTemplate[] {
  return WAREHOUSE_TEMPLATES.filter((t) => t.tab === tab).map((t) => ({
    ...t,
    textLayersByPage: t.textLayersByPage.map((page) =>
      page.map((l) => ({
        ...l,
        text: maskTemplatePii(l.text),
        ranges: l.ranges?.map((r) => ({ ...r })) ?? [],
      }))
    ),
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
