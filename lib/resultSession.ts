export const RESULT_SESSION_KEY = "sca_result_session_v1";
export const SELECTED_RESULT_URL_KEY = "sca_selected_result_url";

export type ResultSession = {
  drafts: string[];
  focusedDraft: 0 | 1;
  selectedResultUrl: string;
  resultView: "compare" | "detail";
  resultReady: boolean;
  portraitId: string | null;
  directEditMode?: boolean;
  /** Face refs for regenerate / background fusion after session restore. */
  selfieUrls?: string[];
  profileId?: string | null;
};

function isUsableImageUrl(url: unknown): url is string {
  return (
    typeof url === "string" &&
    url.trim().length > 8 &&
    (url.startsWith("data:image/") ||
      url.startsWith("blob:") ||
      url.startsWith("https://") ||
      url.startsWith("http://") ||
      url.startsWith("/"))
  );
}

export function saveResultSession(session: ResultSession) {
  if (typeof window === "undefined") return;
  const drafts = session.drafts.filter(isUsableImageUrl).slice(0, 2);
  const selected =
    (isUsableImageUrl(session.selectedResultUrl) && session.selectedResultUrl) ||
    drafts[session.focusedDraft] ||
    drafts[0] ||
    "";
  try {
    sessionStorage.setItem(
      RESULT_SESSION_KEY,
      JSON.stringify({
        ...session,
        drafts,
        selectedResultUrl: selected,
        focusedDraft: session.focusedDraft === 1 ? 1 : 0,
      } satisfies ResultSession)
    );
    if (selected) sessionStorage.setItem(SELECTED_RESULT_URL_KEY, selected);
  } catch {
    try {
      if (selected) sessionStorage.setItem(SELECTED_RESULT_URL_KEY, selected);
    } catch {
      /* quota */
    }
  }
}

export function readResultSession(): ResultSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RESULT_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ResultSession>;
      const drafts = Array.isArray(parsed.drafts)
        ? parsed.drafts.filter(isUsableImageUrl).slice(0, 2)
        : [];
      if (drafts.length > 0) {
        const focusedDraft = parsed.focusedDraft === 1 ? 1 : 0;
        const selected =
          (isUsableImageUrl(parsed.selectedResultUrl) && parsed.selectedResultUrl) ||
          drafts[focusedDraft] ||
          drafts[0];
        return {
          drafts,
          focusedDraft,
          selectedResultUrl: selected,
          resultView: parsed.resultView === "detail" ? "detail" : "compare",
          resultReady: parsed.resultReady !== false,
          portraitId: typeof parsed.portraitId === "string" ? parsed.portraitId : null,
          directEditMode: Boolean(parsed.directEditMode),
          selfieUrls: Array.isArray(parsed.selfieUrls)
            ? parsed.selfieUrls.filter(isUsableImageUrl).slice(0, 10)
            : undefined,
          profileId:
            typeof parsed.profileId === "string" ? parsed.profileId : undefined,
        };
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const selected = sessionStorage.getItem(SELECTED_RESULT_URL_KEY);
    if (isUsableImageUrl(selected)) {
      return {
        drafts: [selected],
        focusedDraft: 0,
        selectedResultUrl: selected,
        resultView: "compare",
        resultReady: true,
        portraitId: null,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearResultSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RESULT_SESSION_KEY);
    sessionStorage.removeItem(SELECTED_RESULT_URL_KEY);
  } catch {
    /* ignore */
  }
}

/** Same-origin display URL so R2/CDN images render in <img> and canvas without CORS gaps. */
export function toDisplayImageSrc(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return `/api/media/fetch?src=${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}
