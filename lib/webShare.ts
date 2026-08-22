/** Browser Web Share + clipboard fallbacks for result / thumbnail sharing. */

export function isShareAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: unknown }).name) : "";
  return name === "AbortError" || name === "NotAllowedError";
}

export type WebSharePayload = {
  title: string;
  text: string;
  url?: string;
  file?: File | null;
};

/**
 * Prefer native share sheet (with file when supported), else copy link / text.
 * Returns how the share completed so callers can toast appropriately.
 */
export async function shareWithFallback(
  payload: WebSharePayload
): Promise<"shared" | "copied" | "cancelled"> {
  const { title, text, url, file } = payload;
  const pageUrl =
    url || (typeof window !== "undefined" ? window.location.href : "");

  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text, url: pageUrl || undefined });
        return "shared";
      }
      await navigator.share({
        title,
        text,
        url: pageUrl || undefined,
      });
      return "shared";
    }
  } catch (err) {
    if (isShareAbortError(err)) return "cancelled";
    // Fall through to clipboard.
  }

  const copyTarget = pageUrl || text;
  if (!copyTarget) throw new Error("Nothing to share");

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(copyTarget);
    return "copied";
  }

  // Legacy execCommand fallback
  const ta = document.createElement("textarea");
  ta.value = copyTarget;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Clipboard copy failed");
  return "copied";
}
