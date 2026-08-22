/**
 * Print wizard deco tool catalog.
 */

export type DecoCategoryId =
  | "dividers"
  | "frames"
  | "badges"
  | "traditional"
  | "geometry";

export type DecoCatalogItem = {
  id: string;
  category: DecoCategoryId;
  variant: number;
  label: string;
  /** Default width as fraction of stage width. */
  defaultWidthFrac: number;
  /** Default height as fraction of stage height. */
  defaultHeightFrac: number;
  /** Resizing behavior for this catalog item. */
  resizeMode?: "free" | "aspect" | "line-x" | "line-y";
};

export const DECO_CATEGORY_LABELS: Record<DecoCategoryId, string> = {
  dividers: "구분선/화살표",
  frames: "프레임/박스",
  badges: "타이틀 배지/리본",
  traditional: "전통/감성 데코문양",
  geometry: "기하학/도형",
};

const DIVIDER_ITEMS: Array<{
  label: string;
  w: number;
  h: number;
  resizeMode: DecoCatalogItem["resizeMode"];
}> = [
  { label: "모던 솔리드 가로선", w: 0.62, h: 0.045, resizeMode: "line-x" },
  { label: "모던 점선 가로선", w: 0.62, h: 0.045, resizeMode: "line-x" },
  { label: "모던 파선 가로선", w: 0.62, h: 0.045, resizeMode: "line-x" },
  { label: "이중 실선 구분선", w: 0.62, h: 0.06, resizeMode: "line-x" },
  { label: "그라데이션 페이드선", w: 0.62, h: 0.06, resizeMode: "line-x" },
  { label: "오른쪽 화살표선", w: 0.62, h: 0.07, resizeMode: "line-x" },
  { label: "왼쪽 화살표선", w: 0.62, h: 0.07, resizeMode: "line-x" },
  { label: "양방향 화살표선", w: 0.62, h: 0.07, resizeMode: "line-x" },
  { label: "쉐브론 구분선", w: 0.62, h: 0.08, resizeMode: "line-x" },
  { label: "물결 구분선", w: 0.62, h: 0.08, resizeMode: "line-x" },
  { label: "지그재그 구분선", w: 0.62, h: 0.08, resizeMode: "line-x" },
  { label: "다이아몬드 체인", w: 0.62, h: 0.08, resizeMode: "line-x" },
  { label: "도트 체인", w: 0.62, h: 0.08, resizeMode: "line-x" },
  { label: "장식 스크롤선", w: 0.62, h: 0.08, resizeMode: "line-x" },
  { label: "브래킷 구분선", w: 0.62, h: 0.08, resizeMode: "line-x" },
  { label: "세로 솔리드선 얇게", w: 0.045, h: 0.44, resizeMode: "line-y" },
  { label: "세로 솔리드선 보통", w: 0.06, h: 0.44, resizeMode: "line-y" },
  { label: "세로 솔리드선 굵게", w: 0.085, h: 0.44, resizeMode: "line-y" },
  { label: "세로 점선", w: 0.05, h: 0.44, resizeMode: "line-y" },
  { label: "세로 파선", w: 0.05, h: 0.44, resizeMode: "line-y" },
  { label: "클래식 이중 세로선", w: 0.08, h: 0.44, resizeMode: "line-y" },
];

const FRAME_LABELS = [
  "심플 사각 프레임",
  "라운드 사각 프레임",
  "이중 테두리 프레임",
  "점선 프레임",
  "코너 브래킷 프레임",
  "장식 코너 프레임",
  "폴라로이드 프레임",
  "티켓 스텁 프레임",
  "말풍선 프레임",
  "구름 프레임",
  "육각 프레임",
  "원형 프레임",
  "타원 프레임",
  "스탬프 테두리",
  "필름스트립 프레임",
];

const BADGE_LABELS = [
  "타이틀 하단 강조 바",
  "리본 배너",
  "필 배지",
  "스타버스트",
  "원형 씰",
  "태그 라벨",
  "코너 리본",
  "웨이브 배너",
  "쉴드 배지",
  "화살표 배너",
  "더블 리본",
  "브래킷 타이틀",
  "하이라이트 바",
  "메달 배지",
  "북마크 탭",
];

const TRADITIONAL_LABELS = [
  "전통 격자 패턴",
  "태극 원형",
  "매화 문양",
  "구름 문양",
  "매듭 문양",
  "한지 질감 프레임",
  "격자 창문",
  "한국식 물결",
  "엔소 원",
  "대나무 줄기",
  "전통 테두리",
  "부채형",
  "월문(달문)",
  "주역 팔괘",
  "소나무 가지",
];

const GEOMETRY_LABELS = [
  "채워진 원",
  "원형 아웃라인",
  "삼각형",
  "회전 사각형",
  "오각형",
  "육각형",
  "별(5)",
  "별(4)",
  "플러스 십자",
  "X 십자",
  "하트",
  "반원",
  "사분원",
  "도넛 링",
  "평행사변형",
];

function buildCategory(
  prefix: DecoCategoryId,
  labels: string[],
  defaults: { w: number; h: number; resizeMode?: DecoCatalogItem["resizeMode"] }
): DecoCatalogItem[] {
  return labels.map((label, variant) => ({
    id: `deco-${prefix}-${String(variant + 1).padStart(2, "0")}`,
    category: prefix,
    variant,
    label,
    defaultWidthFrac: defaults.w,
    defaultHeightFrac: defaults.h,
    resizeMode: defaults.resizeMode,
  }));
}

const DIVIDER_CATALOG: DecoCatalogItem[] = DIVIDER_ITEMS.map((item, variant) => ({
  id: `deco-dividers-${String(variant + 1).padStart(2, "0")}`,
  category: "dividers",
  variant,
  label: item.label,
  defaultWidthFrac: item.w,
  defaultHeightFrac: item.h,
  resizeMode: item.resizeMode,
}));

export const DECO_CATALOG: DecoCatalogItem[] = [
  ...DIVIDER_CATALOG,
  ...buildCategory("frames", FRAME_LABELS, { w: 0.48, h: 0.36, resizeMode: "aspect" }),
  ...buildCategory("badges", BADGE_LABELS, { w: 0.52, h: 0.12, resizeMode: "free" }),
  ...buildCategory("traditional", TRADITIONAL_LABELS, {
    w: 0.4,
    h: 0.4,
    resizeMode: "aspect",
  }),
  ...buildCategory("geometry", GEOMETRY_LABELS, {
    w: 0.22,
    h: 0.22,
    resizeMode: "aspect",
  }),
];

export const DECO_CATALOG_BY_ID: Record<string, DecoCatalogItem> = Object.fromEntries(
  DECO_CATALOG.map((item) => [item.id, item])
);

export const DECO_CATEGORIES: DecoCategoryId[] = [
  "dividers",
  "frames",
  "badges",
  "traditional",
  "geometry",
];

export function decoItemsForCategory(category: DecoCategoryId): DecoCatalogItem[] {
  return DECO_CATALOG.filter((item) => item.category === category);
}

export function isDecoCatalogId(id: unknown): id is string {
  return typeof id === "string" && Boolean(DECO_CATALOG_BY_ID[id]);
}
