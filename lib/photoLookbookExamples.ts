/**
 * Static lookbook example prompts for 화보 뚝딱생성기 「예시」 panel.
 */

import { ID_PHOTO_STYLE_ID } from "@/lib/photoIdPhotoBackground";

export type PhotoLookbookExampleCategoryId =
  | "id-photo"
  | "tradition"
  | "nature"
  | "urban"
  | "indoor"
  | "leisure";

export type PhotoLookbookExampleCategory = {
  id: PhotoLookbookExampleCategoryId;
  label: string;
  examples: readonly string[];
};

/** Single ID-photo preset — shown last in normal mode, alone (top) in ID mode. */
export const PHOTO_ID_PHOTO_EXAMPLE = "흰색바탕배경";

const LOOKBOOK_SCENE_CATEGORIES: readonly PhotoLookbookExampleCategory[] = [
  {
    id: "tradition",
    label: "전통·고궁",
    examples: [
      "경복궁 근정전 앞에서 서 있어요.",
      "창덕궁 후원 대청마루에 단정하게 앉아 있어요.",
      "북촌 한옥마을 돌담 옆에 팔짱을 끼고 서 있어요.",
      "전통 정자 마루에 양손을 무릎 위에 올리고 앉아 있어요.",
    ],
  },
  {
    id: "nature",
    label: "자연·공원",
    examples: [
      "한강공원 잔디밭 의자에 앉아 있어요.",
      "올림픽공원 나무 옆에 가만히 서 있어요.",
      "제주도 유채꽃밭 사이에 서 있어요.",
      "두물머리 강가 벤치에 기대어 앉아 있어요.",
    ],
  },
  {
    id: "urban",
    label: "도심·건축",
    examples: [
      "남산타워 전망대 창가에 서서 정면을 보고 있어요.",
      "롯데월드타워 유리창 앞에 두 손을 모으고 서 있어요.",
      "코엑스 도서관 책장 앞에 책을 들고 서 있어요.",
      "도시 빌딩 로비 의자에 단정하게 앉아 있어요.",
    ],
  },
  {
    id: "indoor",
    label: "실내·스튜디오",
    examples: [
      "밝은 실내 카페 창가 자리에 앉아 있어요.",
      "서재 가죽 소파에 바른 자세로 앉아 있어요.",
      "화이트톤 스튜디오 단색 배경 앞에 서 있어요.",
      "고급 호텔 로비 소파에 기대어 앉아 있어요.",
    ],
  },
  {
    id: "leisure",
    label: "휴양지·레저",
    examples: [
      "몰디브 해변 선베드에 편안하게 앉아 있어요.",
      "골프장 필드 위에 골프채를 가볍게 쥐고 서 있어요.",
      "테니스장 코트 안에 테니스채를 들고 서 있어요.",
      "캠핑장 의자에 정자세로 앉아 있어요.",
    ],
  },
] as const;

const ID_PHOTO_ONLY_CATEGORY: PhotoLookbookExampleCategory = {
  id: "id-photo",
  label: "증명사진",
  examples: [PHOTO_ID_PHOTO_EXAMPLE],
};

/** Full list for non-ID mode: scene categories, then 흰색바탕배경 at the very bottom. */
export const PHOTO_LOOKBOOK_EXAMPLE_CATEGORIES: readonly PhotoLookbookExampleCategory[] =
  [...LOOKBOOK_SCENE_CATEGORIES, ID_PHOTO_ONLY_CATEGORY];

export const PHOTO_LOOKBOOK_EXAMPLE_HINT =
  "한가지를 반드시 선택후 수정해서 사용하세요";

export function isPhotoIdPhotoUiMode(opts: {
  useId?: string | null;
  imageStyleId?: string | null;
}): boolean {
  return (
    opts.useId === "id-photo" || opts.imageStyleId === ID_PHOTO_STYLE_ID
  );
}

/**
 * ID mode → only 「흰색바탕배경」 at top.
 * Normal mode → all scene examples, then 「흰색바탕배경」 last.
 */
export function getPhotoLookbookExampleCategories(opts: {
  useId?: string | null;
  imageStyleId?: string | null;
}): readonly PhotoLookbookExampleCategory[] {
  if (isPhotoIdPhotoUiMode(opts)) {
    return [ID_PHOTO_ONLY_CATEGORY];
  }
  return PHOTO_LOOKBOOK_EXAMPLE_CATEGORIES;
}
