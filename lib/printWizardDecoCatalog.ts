/**
 * Print wizard deco tool catalog (Catalog 1 + Catalog 2).
 */

export type DecoCategoryId =
  | "dividers"
  | "frames"
  | "badges"
  | "traditional"
  | "geometry"
  /** Catalog 2 — practical print assets (no emoji). */
  | "promo"
  | "festival"
  | "info"
  | "modern";

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
  promo: "할인/특가 배지",
  festival: "축제/행사 오브젝트",
  info: "인포그래픽 심볼",
  modern: "모던 구분선",
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

/** Catalog 2 — promo / sale badges (no emoji). */
const PROMO_LABELS = [
  "할인율 원형 배지",
  "특가 필 배지",
  "SALE 리본",
  "HOT 코너 리본",
  "NEW 사각 배지",
  "1+1 원형",
  "반값 스타버스트",
  "타임세일 타이머 배지",
  "마감임박 태그",
  "무료배송 바",
  "쿠폰 티켓",
  "적립금 배지",
  "회원특가 배지",
  "오늘의특가 배너",
  "인기상품 리본",
  "베스트 메달",
  "추천 화살표 배지",
  "한정수량 배지",
  "재고소진 바",
  "가격인하 화살표",
  "원가대비 배지",
  "세트할인 배지",
  "추가할인 필",
  "깜짝세일 스타",
  "주말특가 배너",
  "시즌오프 배지",
  "클리어런스 바",
  "번들특가 배지",
  "첫구매 리본",
  "재구매 배지",
  "앱전용 배지",
  "포인트2배 배지",
  "무료체험 배지",
  "체험단가 배지",
  "오픈기념 배너",
  "런칭특가 배지",
  "사전예약 배지",
  "얼리버드 배지",
  "마감세일 배지",
  "최종가 강조 배지",
];

/** Catalog 2 — festival / event objects (no emoji). */
const FESTIVAL_LABELS = [
  "폭죽 버스트",
  "별빛 스파클",
  "리본 화환",
  "파티 깃발줄",
  "무대 스포트라이트",
  "티켓 스텁",
  "입장권 바코드",
  "축제 배너",
  "이벤트 플래그",
  "라운드 스테이지",
  "축하 리본",
  "금색 메달",
  "은색 메달",
  "동상 트로피 실루엣",
  "하트 화환",
  "별 화환",
  "원형 스탬프",
  "날짜 캘린더 박스",
  "시계 원형",
  "지도 핀",
  "장소 마커",
  "안내 화살표",
  "줄번호 번호판",
  "VIP 패스",
  "게스트 패스",
  "프로그램 북 아이콘",
  "마이크 실루엣",
  "스피커 실루엣",
  "카메라 실루엣",
  "조명 빔",
  "커튼 장식",
  "폭죽 대각선",
  "컨페티 점군",
  "리본 보우",
  "기념일 원형",
  "개막 배너",
  "폐막 배너",
  "특별공연 배지",
  "초청 실루엣",
  "축하 프레임",
];

/** Catalog 2 — infographic symbols (no emoji). */
const INFO_LABELS = [
  "체크 원형",
  "경고 삼각형",
  "정보 i 원형",
  "물음표 원형",
  "숫자1 배지",
  "숫자2 배지",
  "숫자3 배지",
  "숫자4 배지",
  "숫자5 배지",
  "프로세스 화살표",
  "순환 화살표",
  "상승 차트",
  "하락 차트",
  "막대그래프 3단",
  "파이차트 반원",
  "목표 과녁",
  "전구 아이디어",
  "기어 설정",
  "사람 실루엣",
  "그룹 실루엣",
  "건물 실루엣",
  "트럭 배송",
  "문서 아이콘",
  "클립보드",
  "자물쇠 보안",
  "방패 보호",
  "와이파이 심볼",
  "위치 핀",
  "전화 수화기",
  "메일 봉투",
  "채팅 말풍선",
  "달력",
  "시계",
  "별점 5점",
  "하트 좋아요",
  "엄지 추천",
  "손바닥 스톱",
  "확대경 검색",
  "다운로드 화살표",
  "업로드 화살표",
];

/** Catalog 2 — modern divider lines (no emoji). */
const MODERN_LINE_ITEMS: Array<{
  label: string;
  w: number;
  h: number;
  resizeMode: DecoCatalogItem["resizeMode"];
}> = [
  { label: "초슬림 솔리드선", w: 0.7, h: 0.03, resizeMode: "line-x" },
  { label: "미디엄 솔리드선", w: 0.7, h: 0.045, resizeMode: "line-x" },
  { label: "볼드 솔리드선", w: 0.7, h: 0.06, resizeMode: "line-x" },
  { label: "미세 점선", w: 0.7, h: 0.04, resizeMode: "line-x" },
  { label: "라운드 점선", w: 0.7, h: 0.05, resizeMode: "line-x" },
  { label: "장단 대시선", w: 0.7, h: 0.045, resizeMode: "line-x" },
  { label: "이중 헤어라인", w: 0.7, h: 0.055, resizeMode: "line-x" },
  { label: "삼중 라인", w: 0.7, h: 0.07, resizeMode: "line-x" },
  { label: "센터 도트 라인", w: 0.7, h: 0.06, resizeMode: "line-x" },
  { label: "센터 다이아 라인", w: 0.7, h: 0.07, resizeMode: "line-x" },
  { label: "센터 스퀘어 라인", w: 0.7, h: 0.07, resizeMode: "line-x" },
  { label: "페이드 인아웃 라인", w: 0.72, h: 0.055, resizeMode: "line-x" },
  { label: "웨이브 미세선", w: 0.7, h: 0.08, resizeMode: "line-x" },
  { label: "사인파 라인", w: 0.7, h: 0.09, resizeMode: "line-x" },
  { label: "지그재그 미세선", w: 0.7, h: 0.08, resizeMode: "line-x" },
  { label: "쉐브론 미세선", w: 0.7, h: 0.08, resizeMode: "line-x" },
  { label: "브래킷 엔드 라인", w: 0.7, h: 0.08, resizeMode: "line-x" },
  { label: "화살촉 엔드 라인", w: 0.7, h: 0.07, resizeMode: "line-x" },
  { label: "양쪽 화살 라인", w: 0.7, h: 0.07, resizeMode: "line-x" },
  { label: "점-선-점 패턴", w: 0.7, h: 0.05, resizeMode: "line-x" },
  { label: "도트열 라인", w: 0.7, h: 0.06, resizeMode: "line-x" },
  { label: "대시-도트 라인", w: 0.7, h: 0.05, resizeMode: "line-x" },
  { label: "그라데이션 바", w: 0.7, h: 0.06, resizeMode: "line-x" },
  { label: "언더라인 강조", w: 0.55, h: 0.04, resizeMode: "line-x" },
  { label: "타이틀 언더바", w: 0.4, h: 0.035, resizeMode: "line-x" },
  { label: "섹션 구분 바", w: 0.85, h: 0.05, resizeMode: "line-x" },
  { label: "세로 헤어라인", w: 0.03, h: 0.5, resizeMode: "line-y" },
  { label: "세로 미디엄선", w: 0.05, h: 0.5, resizeMode: "line-y" },
  { label: "세로 볼드선", w: 0.075, h: 0.5, resizeMode: "line-y" },
  { label: "세로 점선", w: 0.04, h: 0.5, resizeMode: "line-y" },
  { label: "세로 대시선", w: 0.04, h: 0.5, resizeMode: "line-y" },
  { label: "세로 이중선", w: 0.07, h: 0.5, resizeMode: "line-y" },
  { label: "세로 삼중선", w: 0.09, h: 0.5, resizeMode: "line-y" },
  { label: "코너 L자 라인", w: 0.28, h: 0.28, resizeMode: "aspect" },
  { label: "코너 브래킷", w: 0.28, h: 0.28, resizeMode: "aspect" },
  { label: "십자 교차선", w: 0.35, h: 0.35, resizeMode: "aspect" },
  { label: "사선 슬래시", w: 0.4, h: 0.12, resizeMode: "free" },
  { label: "역사선 슬래시", w: 0.4, h: 0.12, resizeMode: "free" },
  { label: "더블 슬래시", w: 0.42, h: 0.14, resizeMode: "free" },
  { label: "미니 구분점 3개", w: 0.22, h: 0.06, resizeMode: "line-x" },
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

const MODERN_CATALOG: DecoCatalogItem[] = MODERN_LINE_ITEMS.map((item, variant) => ({
  id: `deco-modern-${String(variant + 1).padStart(2, "0")}`,
  category: "modern",
  variant,
  label: item.label,
  defaultWidthFrac: item.w,
  defaultHeightFrac: item.h,
  resizeMode: item.resizeMode,
}));

/** Catalog 1 — basic lines, shapes, frames (existing). */
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

/** Catalog 2 — practical print assets (promo / festival / info / modern). No emoji. */
export const DECO_CATALOG_2: DecoCatalogItem[] = [
  ...buildCategory("promo", PROMO_LABELS, { w: 0.28, h: 0.16, resizeMode: "aspect" }),
  ...buildCategory("festival", FESTIVAL_LABELS, { w: 0.32, h: 0.28, resizeMode: "aspect" }),
  ...buildCategory("info", INFO_LABELS, { w: 0.18, h: 0.18, resizeMode: "aspect" }),
  ...MODERN_CATALOG,
];

export const DECO_CATALOG_BY_ID: Record<string, DecoCatalogItem> = Object.fromEntries(
  [...DECO_CATALOG, ...DECO_CATALOG_2].map((item) => [item.id, item])
);

export const DECO_CATEGORIES: DecoCategoryId[] = [
  "dividers",
  "frames",
  "badges",
  "traditional",
  "geometry",
];

export const DECO_CATEGORIES_2: DecoCategoryId[] = [
  "promo",
  "festival",
  "info",
  "modern",
];

export function decoItemsForCategory(category: DecoCategoryId): DecoCatalogItem[] {
  return (DECO_CATEGORIES_2.includes(category) ? DECO_CATALOG_2 : DECO_CATALOG).filter(
    (item) => item.category === category
  );
}

export function isDecoCatalogId(id: unknown): id is string {
  return typeof id === "string" && Boolean(DECO_CATALOG_BY_ID[id]);
}
