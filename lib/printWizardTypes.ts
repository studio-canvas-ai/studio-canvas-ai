/**
 * Print wizard (Step 2) — shared types & option catalogs.
 * Add / remove formats, uses, page counts, presets, or form fields here
 * without touching layout components.
 */

import {
  emptyVisualStyleSelection,
  type VisualStyleSelection,
} from "@/lib/ai/visualStylePresets";
import type { TextLayer } from "@/lib/thumbnailStyles";

export const PRINT_WIZARD_SESSION_KEY = "sca_print_wizard_v5";

/** Physical / digital format (규격) — drives preview aspect. Labels only, no category blurbs. */
export const PRINT_FORMATS = [
  { id: "original", label: "원본", aspect: 1 },
  { id: "ratio-1-1", label: "1:1", aspect: 1 },
  { id: "ratio-16-9", label: "16:9", aspect: 16 / 9 },
  { id: "ratio-4-3", label: "4:3", aspect: 4 / 3 },
  { id: "ratio-9-16", label: "9:16", aspect: 9 / 16 },
  { id: "ratio-3-1", label: "3:1", aspect: 3 },
  { id: "ratio-4-1", label: "4:1", aspect: 4 },
  { id: "ratio-4-5", label: "4:5", aspect: 4 / 5 },
  { id: "a2", label: "A2", aspect: 420 / 594 },
  { id: "a3", label: "A3", aspect: 297 / 420 },
  { id: "a4", label: "A4", aspect: 210 / 297 },
  { id: "id-photo", label: "3.5 x 4.5 cm", aspect: 3.5 / 4.5 },
  { id: "invite-square-150", label: "150×150 mm", aspect: 1 },
  { id: "invite-postcard-100x150", label: "100×150 mm", aspect: 100 / 150 },
  { id: "free", label: "직접 입력 / 프리 사이즈", aspect: 1 },
] as const;

export type PrintFormatId = (typeof PRINT_FORMATS)[number]["id"];

/** Purpose / use case (용도). */
export const PRINT_USES = [
  { id: "banner", label: "배너" },
  { id: "lookbook", label: "화보" },
  { id: "calendar", label: "달력" },
  { id: "sns", label: "SNS" },
  { id: "poster", label: "포스터" },
  { id: "id-photo", label: "증명사진" },
  { id: "pamphlet", label: "팸플릿" },
  { id: "menu", label: "메뉴판" },
  { id: "flyer", label: "전단지" },
  { id: "hanging-banner", label: "현수막" },
  { id: "brochure", label: "브로슈어" },
  { id: "leaflet", label: "리플렛" },
  { id: "business-card", label: "명함" },
  { id: "card-news", label: "카드뉴스" },
  { id: "detail-page", label: "상세페이지" },
  { id: "presentation", label: "프리젠테이션" },
  { id: "invitation", label: "청첩장·초청장" },
] as const;

export type PrintUseId = (typeof PRINT_USES)[number]["id"];

/** @deprecated Prefer PRINT_FORMATS + PRINT_USES — kept for session migration. */
export const PRINT_CATEGORIES = [
  {
    id: "a4-tri-fold",
    label: "A4 3단 팜플렛",
    aspect: 1.414 / 1,
    previewHint: "A4 가로 · 3단 접지",
  },
  {
    id: "store-menu",
    label: "매장 메뉴판",
    aspect: 210 / 297,
    previewHint: "A4 세로 메뉴",
  },
  {
    id: "event-flyer",
    label: "행사 전단지",
    aspect: 210 / 297,
    previewHint: "A4 전단지",
  },
  {
    id: "promo-banner",
    label: "홍보 현수막",
    aspect: 3 / 1,
    previewHint: "가로형 현수막",
  },
] as const;

export type PrintCategoryId = (typeof PRINT_CATEGORIES)[number]["id"];

/** Page-count options — 단면…10면. */
export const PRINT_PAGE_COUNTS = [
  { value: 1, label: "단면" },
  { value: 2, label: "양면(2면)" },
  { value: 3, label: "3면" },
  { value: 4, label: "4면" },
  { value: 5, label: "5면" },
  { value: 6, label: "6면" },
  { value: 7, label: "7면" },
  { value: 8, label: "8면" },
  { value: 9, label: "9면" },
  { value: 10, label: "10면" },
] as const;

export type PrintPageCount = (typeof PRINT_PAGE_COUNTS)[number]["value"];

export type FieldGroupId =
  | "event"
  | "corporate"
  | "dining"
  | "wedding"
  | "education";

export type FieldLayoutKind =
  | "poster-bold"
  | "festival"
  | "formal"
  | "seminar"
  | "corporate"
  | "product"
  | "public"
  | "menu"
  | "cafe"
  | "bar"
  | "wedding"
  | "celebration"
  | "party"
  | "education"
  | "realestate"
  | "invitation";

export type FieldItem = {
  id: string;
  label: string;
  keyword: string;
  layout: FieldLayoutKind;
};

export type FieldCategory = {
  id: FieldGroupId;
  label: string;
  items: readonly FieldItem[];
};

/** 분야 — grouped print-use context for AI background + auto layout. */
export const FIELD_CATEGORIES: readonly FieldCategory[] = [
  {
    id: "event",
    label: "행사용",
    items: [
      {
        id: "event-sports",
        label: "체육대회·운동회",
        keyword:
          "energetic outdoor sports field, school athletic meet, stadium banners, sunlight, print poster background, no text, no letters",
        layout: "poster-bold",
      },
      {
        id: "event-festival",
        label: "지역축제·공연",
        keyword:
          "regional festival night, outdoor stage lights, cultural performance, festive atmosphere, print poster background, no text",
        layout: "festival",
      },
      {
        id: "event-alumni",
        label: "동문회·향우회",
        keyword:
          "warm alumni reunion gathering, nostalgic banquet hall, class reunion flyer background, no text",
        layout: "formal",
      },
      {
        id: "event-seminar",
        label: "학술·세미나·총회",
        keyword:
          "academic conference hall, seminar auditorium, clean professional lighting, program booklet background, no text",
        layout: "seminar",
      },
    ],
  },
  {
    id: "corporate",
    label: "기업·홍보용",
    items: [
      {
        id: "corporate-branding",
        label: "회사소개·브랜딩",
        keyword:
          "modern corporate branding, premium office, clean brochure background, no text",
        layout: "corporate",
      },
      {
        id: "corporate-product",
        label: "제품·서비스 홍보",
        keyword:
          "product launch showcase, commercial studio, service promo print background, no text",
        layout: "product",
      },
      {
        id: "corporate-public",
        label: "공공기관·정책 홍보",
        keyword:
          "public institution campaign, civic official print, policy poster background, no text",
        layout: "public",
      },
    ],
  },
  {
    id: "dining",
    label: "식당·카페용",
    items: [
      {
        id: "dining-korean",
        label: "한식·고깃집·전문점",
        keyword:
          "Korean restaurant, barbecue, warm gourmet table setting, menu print background, no text",
        layout: "menu",
      },
      {
        id: "dining-cafe",
        label: "카페·베이커리·디저트",
        keyword:
          "cafe bakery dessert, cozy natural light, pastry display, print menu background, no text",
        layout: "cafe",
      },
      {
        id: "dining-bar",
        label: "주점·요리주점",
        keyword:
          "izakaya gastropub, moody warm night lighting, bar menu print background, no text",
        layout: "bar",
      },
    ],
  },
  {
    id: "wedding",
    label: "웨딩·초청",
    items: [
      {
        id: "wedding-invitation",
        label: "결혼식 청첩장",
        keyword:
          "romantic wedding invitation, soft pastel flowers, elegant print background, no text",
        layout: "wedding",
      },
      {
        id: "wedding-celebration",
        label: "돌잔치·환갑·고스락",
        keyword:
          "Korean first birthday doljanchi, 60th hwangap celebration, festive invitation background, no text",
        layout: "celebration",
      },
      {
        id: "wedding-party",
        label: "파티·모임 초대장",
        keyword:
          "party gathering invitation, cheerful celebration, print invite background, no text",
        layout: "party",
      },
    ],
  },
  {
    id: "education",
    label: "교육·기타",
    items: [
      {
        id: "education-academy",
        label: "학원·교육·강좌",
        keyword:
          "academy classroom, education lecture, clean study atmosphere, print flyer background, no text",
        layout: "education",
      },
      {
        id: "education-realestate",
        label: "부동산·분양 홍보",
        keyword:
          "real estate sales, apartment model house, property brochure background, no text",
        layout: "realestate",
      },
    ],
  },
] as const;

/** Flattened 분야 items — used as bgPresetId / AI context. */
export const BG_PRESETS = FIELD_CATEGORIES.flatMap((group) =>
  group.items.map((item) => ({
    id: item.id,
    label: item.label,
    keyword: item.keyword,
    groupId: group.id,
    layout: item.layout,
  }))
);

export type BgPresetId = (typeof BG_PRESETS)[number]["id"];

const LEGACY_FIELD_IDS: Record<string, BgPresetId> = {
  restaurant: "dining-korean",
  cafe: "dining-cafe",
  event: "event-festival",
  corporate: "corporate-branding",
  wedding: "wedding-invitation",
};

export function normalizeFieldId(id: unknown): BgPresetId | null {
  if (typeof id !== "string") return null;
  if (BG_PRESETS.some((p) => p.id === id)) return id as BgPresetId;
  return LEGACY_FIELD_IDS[id] ?? null;
}

export function fieldById(id: string | null | undefined) {
  if (!id) return null;
  const normalized = normalizeFieldId(id);
  return BG_PRESETS.find((p) => p.id === normalized) ?? null;
}

/** Form field catalog — append / remove entries without rewriting the form UI. */
export const SMART_INPUT_FIELDS = [
  {
    id: "date",
    kind: "date" as const,
    label: "날짜",
    placeholder: "행사·게시 날짜",
    emoji: "📅",
  },
  {
    id: "title",
    kind: "text" as const,
    label: "메인 제목",
    placeholder: "인쇄물에 크게 들어갈 타이틀",
    emoji: "📝",
  },
  {
    id: "subtitle",
    kind: "text" as const,
    label: "서브타이틀",
    placeholder: "보조 문구 · 슬로건",
    emoji: "✏️",
  },
  {
    id: "location",
    kind: "text" as const,
    label: "장소",
    placeholder: "장소 / 주소",
    emoji: "📍",
  },
  {
    id: "organizer",
    kind: "text" as const,
    label: "주관 / 주최",
    placeholder: "주관·주최 기관명",
    emoji: "🏢",
  },
  {
    id: "programs",
    kind: "textarea" as const,
    label: "프로그램 · 상세 내용",
    placeholder: "프로그램 목록 또는 상세 안내 (줄바꿈으로 구분)",
    emoji: "📜",
    rows: 4,
  },
] as const;

export type SmartInputFieldId = (typeof SMART_INPUT_FIELDS)[number]["id"];

export type SmartInputValues = Record<SmartInputFieldId, string>;

export function emptySmartInputValues(): SmartInputValues {
  return {
    date: "",
    title: "",
    subtitle: "",
    location: "",
    organizer: "",
    programs: "",
  };
}

export type PrintCustomUnit = "cm" | "inch";

/** Physical free-size from 규격 → 직접 입력 / 프리 사이즈. */
export type PrintCustomSize = {
  unit: PrintCustomUnit;
  width: number;
  height: number;
};

export const PRINT_CUSTOM_SIZE_MAX_CM = 1500;
export const PRINT_CUSTOM_SIZE_MAX_INCH =
  Math.round((PRINT_CUSTOM_SIZE_MAX_CM / 2.54) * 10) / 10;

export type PrintWizardStep = 1 | 2;

export type PrintWizardState = {
  formatId: PrintFormatId;
  useId: PrintUseId;
  pageCount: PrintPageCount;
  bgKeyword: string;
  bgPresetId: BgPresetId | null;
  /** Primary / shared background (legacy + page 1 fallback). */
  backgroundUrl: string | null;
  /** Per-page backgrounds aligned with pageCount (index 0 = 1면). */
  backgroundUrls: string[];
  /** Free-form order / prompt (preset injection target). */
  mainPrompt: string;
  selectedPromptPresetId: string | null;
  /** Applied when formatId === "free". */
  customSize: PrintCustomSize | null;
  inputs: SmartInputValues;
  /** Per-page text layer layouts (index 0 = 1면). */
  textLayersByPage?: TextLayer[][];
  /** Visual style / mood for Flux modifiers (Form AI bg + agent). */
  visualStyle: VisualStyleSelection;
  /** Wizard screen — 1 = input/planning, 2 = canvas + advanced edit. */
  wizardStep?: PrintWizardStep;
  /** Step 1 draft render completed at least once. */
  draftReady?: boolean;
  /** User dismissed fold-line guides (cut/safe lines always remain). */
  foldGuidesHidden?: boolean;
};

export function defaultPrintWizardState(): PrintWizardState {
  return {
    formatId: "a4",
    useId: "flyer",
    pageCount: 2,
    bgKeyword: "",
    bgPresetId: null,
    backgroundUrl: null,
    backgroundUrls: [],
    mainPrompt: "",
    selectedPromptPresetId: null,
    customSize: null,
    inputs: emptySmartInputValues(),
    visualStyle: emptyVisualStyleSelection(),
    wizardStep: 1,
    draftReady: false,
    foldGuidesHidden: false,
  };
}

export function formatById(id: PrintFormatId | string) {
  const found = PRINT_FORMATS.find((f) => f.id === id);
  return found ?? PRINT_FORMATS.find((f) => f.id === "a4")!;
}

/** Preview / export aspect — uses free-size when set. */
export function resolvePrintAspect(
  formatId: PrintFormatId | string,
  customSize: PrintCustomSize | null | undefined
): number {
  if (
    formatId === "free" &&
    customSize &&
    Number.isFinite(customSize.width) &&
    Number.isFinite(customSize.height) &&
    customSize.width > 0 &&
    customSize.height > 0
  ) {
    return customSize.width / customSize.height;
  }
  return formatById(formatId).aspect;
}

export function formatCustomSizeLabel(size: PrintCustomSize): string {
  const unit = size.unit === "cm" ? "cm" : "인치";
  return `${size.width}×${size.height}${unit}`;
}

export function useById(id: PrintUseId | string) {
  const found = PRINT_USES.find((u) => u.id === id);
  return found ?? PRINT_USES.find((u) => u.id === "flyer")!;
}

/** @deprecated */
export function categoryById(id: PrintCategoryId) {
  return PRINT_CATEGORIES.find((c) => c.id === id) ?? PRINT_CATEGORIES[2];
}

export function pageCountLabel(value: PrintPageCount): string {
  return (
    PRINT_PAGE_COUNTS.find((p) => p.value === value)?.label ?? `${value}면`
  );
}

/** Normalize legacy format ids from older sessions. */
export function normalizeFormatId(id: unknown): PrintFormatId | null {
  if (typeof id !== "string") return null;
  if (PRINT_FORMATS.some((f) => f.id === id)) return id as PrintFormatId;
  switch (id) {
    case "a4-portrait":
    case "a4-landscape":
      return "a4";
    case "banner":
      return "ratio-3-1";
    default:
      return null;
  }
}

/** Normalize legacy use ids from older sessions. */
export function normalizeUseId(id: unknown): PrintUseId | null {
  if (typeof id !== "string") return null;
  if (PRINT_USES.some((u) => u.id === id)) return id as PrintUseId;
  switch (id) {
    case "banner-use":
      return "hanging-banner";
    default:
      return null;
  }
}

/** Map legacy categoryId → format + use. */
export function migrateCategoryToFormatUse(id: string): {
  formatId: PrintFormatId;
  useId: PrintUseId;
} {
  switch (id) {
    case "a4-tri-fold":
      return { formatId: "a4", useId: "pamphlet" };
    case "store-menu":
      return { formatId: "a4", useId: "menu" };
    case "promo-banner":
      return { formatId: "ratio-3-1", useId: "hanging-banner" };
    case "event-flyer":
    default:
      return { formatId: "a4", useId: "flyer" };
  }
}
