/**
 * 4-category keyword tags for AI background prompt append.
 * Used by the print-wizard 「예시」 dropdown.
 */

export type KeywordTagCategoryId =
  | "background"
  | "mood"
  | "event"
  | "product";

export type KeywordTagCategory = {
  id: KeywordTagCategoryId;
  tags: readonly string[];
};

export const KEYWORD_TAG_CATEGORIES: readonly KeywordTagCategory[] = [
  {
    id: "background",
    tags: [
      "한강공원야경",
      "전통한옥",
      "푸른잔디밭",
      "한옥마루",
      "고급대리석",
      "미니멀화이트",
      "네온시티",
      "숲속자연광",
      "바다수평선",
      "도심스카이라인",
      "벚꽃거리",
      "가을단풍",
      "눈내린고궁",
      "카페인테리어",
      "갤러리화이트월",
      "산안개풍경",
      "석양노을",
      "비오는거리",
      "도서관서가",
      "럭셔리호텔로비",
    ],
  },
  {
    id: "mood",
    tags: [
      "로맨틱분위기",
      "은은한조명",
      "역동적인느낌",
      "우아한분위기",
      "골드톤",
      "파스텔그라데이션",
      "따뜻한스튜디오조명",
      "시네마틱무드",
      "따뜻한목재느낌",
      "밝고경쾌한",
      "고급스러운무드",
      "청량한느낌",
      "몽환적인분위기",
      "빈티지감성",
      "모던미니멀",
      "따뜻한노을빛",
      "차가운블루톤",
      "축제같은활기",
      "고요한명상무드",
      "프리미엄럭셔리",
    ],
  },
  {
    id: "event",
    tags: [
      "축제무대",
      "열정적인콘서트",
      "한국무용",
      "클래식음악회",
      "패션쇼",
      "지역축제",
      "야외공연",
      "결혼식",
      "전시회오프닝",
      "기업세미나",
      "마라톤대회",
      "푸드페스티벌",
      "뮤지컬공연",
      "재즈페스티벌",
      "어린이행사",
      "졸업식",
      "신년음악회",
      "불꽃축제",
      "전통무용공연",
      "아트페어",
    ],
  },
  {
    id: "product",
    tags: [
      "시그니처제품",
      "프리미엄패키지",
      "브랜드아이덴티티",
      "스튜디오촬영",
      "고급브로슈어",
      "제품쇼케이스",
      "화장품화보",
      "주얼리디스플레이",
      "카페메뉴연출",
      "패션룩북",
      "테크제품",
      "식품패키지",
      "와인바연출",
      "스킨케어라인",
      "리테일매장",
      "명품쇼윈도",
      "핸드메이드공방",
      "기업CI",
      "신제품런칭",
      "라이프스타일브랜드",
    ],
  },
] as const;

export function toggleKeywordTag(current: string, tag: string): string {
  const next = tag.trim();
  if (!next) return current;
  const parts = current
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.includes(next)) {
    return parts.filter((p) => p !== next).join(", ");
  }
  return parts.length ? `${parts.join(", ")}, ${next}` : next;
}

export function appendKeywordTag(current: string, tag: string): string {
  const next = tag.trim();
  if (!next) return current;
  const trimmed = current.trim();
  if (!trimmed) return next;
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.includes(next)) return trimmed;
  return `${trimmed}, ${next}`;
}

export function selectedKeywordTags(current: string): Set<string> {
  return new Set(
    current
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
  );
}
