export const TRAIN_SELECTION_MIN = 2;
export const TRAIN_SELECTION_MAX = 10;
export const TRAIN_SELECTION_STORAGE_KEY = "sca_train_selection_batch";

export function saveTrainSelection(urls: string[]) {
  if (typeof window === "undefined") return;
  const cleaned = urls
    .filter(
      (url) =>
        typeof url === "string" &&
        (url.startsWith("data:image/") ||
          url.startsWith("https://") ||
          url.startsWith("http://"))
    )
    .slice(0, TRAIN_SELECTION_MAX);
  try {
    sessionStorage.setItem(TRAIN_SELECTION_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    /* quota */
  }
}

export function readTrainSelection(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(TRAIN_SELECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (url): url is string =>
          typeof url === "string" &&
          (url.startsWith("data:image/") ||
            url.startsWith("https://") ||
            url.startsWith("http://"))
      )
      .slice(0, TRAIN_SELECTION_MAX);
  } catch {
    return [];
  }
}

export function clearTrainSelection() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(TRAIN_SELECTION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
