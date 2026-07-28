import { loadJson, saveJson, STORAGE_KEYS } from "@/lib/storage";

export type ReleaseNote = {
  id: string;
  version: string;
  date: string;
  highlights: { kr: string; en: string }[];
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: "2026-07-r3",
    version: "3.0",
    date: "2026-07-28",
    highlights: [
      {
        kr: "시안 2장 동시 생성 + 다시 만들기 / 다중 시안 선택 수정",
        en: "2 drafts per generate + regenerate & focused edit",
      },
      {
        kr: "유튜브 썸네일 CTR 진단 · A/B 시안 · Safe Zone 가이드",
        en: "YouTube thumbnail CTR tips, A/B drafts, safe-zone guides",
      },
      {
        kr: "얼굴 프로필 슬롯 관리 · 크레딧 단품 충전 · 1:1 고객센터",
        en: "Face profile slots, credit add-ons, 1:1 support center",
      },
    ],
  },
];

export function getUnseenReleaseIds(): string[] {
  const seen = loadJson<string[]>(STORAGE_KEYS.releaseSeen, []);
  return RELEASE_NOTES.map((r) => r.id).filter((id) => !seen.includes(id));
}

export function markReleasesSeen(ids: string[]) {
  const seen = new Set(loadJson<string[]>(STORAGE_KEYS.releaseSeen, []));
  ids.forEach((id) => seen.add(id));
  saveJson(STORAGE_KEYS.releaseSeen, [...seen]);
}

/** Simple heuristic CTR score for thumbnail copy (#62) */
export function estimateCtrScore(text: string, hasEmoji: boolean, hasSafeZone: boolean): {
  score: number;
  tips: string[];
} {
  let score = 55;
  const tips: string[] = [];
  const len = text.trim().length;
  if (len >= 8 && len <= 28) score += 12;
  else {
    tips.push("short");
    score -= 5;
  }
  if (hasEmoji) score += 8;
  else tips.push("emoji");
  if (/[?!]|실화|후회|Must|Wait|🔥|🚨/.test(text)) score += 10;
  else tips.push("hook");
  if (hasSafeZone) score += 5;
  if (text.split("\n").length > 3) {
    score -= 8;
    tips.push("lines");
  }
  return { score: Math.max(20, Math.min(98, score)), tips };
}
