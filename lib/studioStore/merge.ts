import { parseStudioProject } from "@/lib/canvas/projectFile";
import type { PhotoVaultItem } from "@/lib/photoVaultStorage";
import type { RecentDrawerEntry } from "@/lib/studioStore/types";

function projectCompleteness(project: RecentDrawerEntry["project"]): number {
  let score = 0;
  const urls = [project.studio.subjectUrl, project.studio.backgroundUrl || ""];
  for (const u of urls) {
    if (!u) continue;
    score += u.startsWith("data:") ? (u.length > 32 ? 2 : 0) : u.length > 8 ? 2 : 0;
  }
  const lookbook = project.lookbook;
  if (!lookbook) return score;
  for (const item of [...lookbook.uploadVault, ...lookbook.trainedVault]) {
    if (item?.src?.trim()) score += 3;
  }
  return score;
}

export function mergeRecentEntries(
  ...groups: RecentDrawerEntry[][]
): RecentDrawerEntry[] {
  const map = new Map<string, RecentDrawerEntry>();
  for (const group of groups) {
    for (const entry of group) {
      if (!entry?.id || !entry.project || !entry.meta) continue;
      let parsed = entry;
      try {
        parsed = {
          ...entry,
          project: parseStudioProject(entry.project),
        };
      } catch {
        continue;
      }
      const prev = map.get(parsed.id);
      if (!prev) {
        map.set(parsed.id, parsed);
        continue;
      }
      const nextScore = projectCompleteness(parsed.project);
      const prevScore = projectCompleteness(prev.project);
      if (
        nextScore > prevScore ||
        (nextScore === prevScore &&
          (parsed.meta.savedAt || 0) > (prev.meta.savedAt || 0))
      ) {
        map.set(parsed.id, parsed);
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.meta.savedAt || 0) - (a.meta.savedAt || 0))
    .slice(0, 10);
}

export function mergeVaultItems(
  ...groups: PhotoVaultItem[][]
): PhotoVaultItem[] {
  const map = new Map<string, PhotoVaultItem>();
  for (const group of groups) {
    for (const item of group) {
      if (!item?.id || !item.src?.trim()) continue;
      const prev = map.get(item.id);
      if (!prev || item.src.length > prev.src.length) {
        map.set(item.id, item);
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 10);
}

export function vaultsFromLookbooks(entries: RecentDrawerEntry[]): {
  upload: PhotoVaultItem[];
  trained: PhotoVaultItem[];
} {
  const upload: PhotoVaultItem[] = [];
  const trained: PhotoVaultItem[] = [];
  for (const entry of entries) {
    const lookbook = entry.project.lookbook;
    if (!lookbook) continue;
    upload.push(...(lookbook.uploadVault || []));
    trained.push(...(lookbook.trainedVault || []));
  }
  return { upload, trained };
}
