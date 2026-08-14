/**
 * Print wizard (Step 2) — shared types & option catalogs.
 * Add / remove categories, page counts, presets, or form fields here
 * without touching layout components.
 */

export const PRINT_WIZARD_SESSION_KEY = "sca_print_wizard_v3";

/** Physical print format (규격) — drives preview aspect. */
export const PRINT_FORMATS = [
  {
    id: "a4-landscape",
    label: "A4 가로",
    aspect: 297 / 210,
    previewHint: "A4 가로",
  },
  {
    id: "a4-portrait",
    label: "A4 세로",
    aspect: 210 / 297,
    previewHint: "A4 세로",
  },
  {
    id: "banner",
    label: "현수막",
    aspect: 3 / 1,
    previewHint: "가로형 현수막",
  },
] as const;

export type PrintFormatId = (typeof PRINT_FORMATS)[number]["id"];

/** Purpose / use case (용도). */
export const PRINT_USES = [
  { id: "pamphlet", label: "팜플렛" },
  { id: "menu", label: "메뉴판" },
  { id: "flyer", label: "전단지" },
  { id: "banner-use", label: "현수막" },
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

/** Slim page-count bar options (단면 = 1). */
export const PRINT_PAGE_COUNTS = [
  { value: 1, label: "단면" },
  { value: 2, label: "2면" },
  { value: 4, label: "4면" },
  { value: 6, label: "6면" },
  { value: 8, label: "8면" },
  { value: 10, label: "10면" },
] as const;

export type PrintPageCount = (typeof PRINT_PAGE_COUNTS)[number]["value"];

export const BG_PRESETS = [
  {
    id: "restaurant",
    label: "식당용",
    keyword: "따뜻한 조명, 미식 레스토랑, 우아한 테이블 세팅, 고급스러운 인쇄물 배경",
  },
  {
    id: "event",
    label: "행사용",
    keyword: "축제 분위기, 부드러운 빛 입자, 축하 행사, 세련된 포스터 배경",
  },
  {
    id: "cafe",
    label: "카페용",
    keyword: "아늑한 카페, 커피 톤, 부드러운 자연광, 미니멀 인테리어",
  },
  {
    id: "corporate",
    label: "기업·홍보용",
    keyword: "모던 오피스, 클린한 그라데이션, 전문적인 기업 브로슈어 배경",
  },
  {
    id: "wedding",
    label: "웨딩·초청",
    keyword: "로맨틱한 꽃과 빛, 소프트 파스텔, 웨딩 초대장 배경",
  },
] as const;

export type BgPresetId = (typeof BG_PRESETS)[number]["id"];

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

export type PrintWizardState = {
  formatId: PrintFormatId;
  useId: PrintUseId;
  pageCount: PrintPageCount;
  bgKeyword: string;
  bgPresetId: BgPresetId | null;
  backgroundUrl: string | null;
  /** Free-form order / prompt (preset injection target). */
  mainPrompt: string;
  selectedPromptPresetId: string | null;
  inputs: SmartInputValues;
};

export function defaultPrintWizardState(): PrintWizardState {
  return {
    formatId: "a4-portrait",
    useId: "flyer",
    pageCount: 2,
    bgKeyword: "",
    bgPresetId: null,
    backgroundUrl: null,
    mainPrompt: "",
    selectedPromptPresetId: null,
    inputs: emptySmartInputValues(),
  };
}

export function formatById(id: PrintFormatId) {
  return PRINT_FORMATS.find((f) => f.id === id) ?? PRINT_FORMATS[1];
}

export function useById(id: PrintUseId) {
  return PRINT_USES.find((u) => u.id === id) ?? PRINT_USES[2];
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

/** Map legacy categoryId → format + use. */
export function migrateCategoryToFormatUse(id: string): {
  formatId: PrintFormatId;
  useId: PrintUseId;
} {
  switch (id) {
    case "a4-tri-fold":
      return { formatId: "a4-landscape", useId: "pamphlet" };
    case "store-menu":
      return { formatId: "a4-portrait", useId: "menu" };
    case "promo-banner":
      return { formatId: "banner", useId: "banner-use" };
    case "event-flyer":
    default:
      return { formatId: "a4-portrait", useId: "flyer" };
  }
}
