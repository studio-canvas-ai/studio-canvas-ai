/**
 * Permanent Screen ID registry — NEVER renumber or reuse IDs.
 * New screens append the next free SCREEN-NNN only.
 * Used for admin debug badges and internal screen references.
 */

export type ScreenRegistryEntry = {
  /** Stable forever. Do not change after ship. */
  id: string;
  /** Canonical app pathname (no trailing slash except home). */
  path: string;
  /** Human label for docs / audits (not shown on badge). */
  label: string;
};

/**
 * Exhaustive route inventory as of 2026-08-24.
 * Append-only: do not reorder, renumber, or delete IDs (mark retired in comments if needed).
 */
export const SCREEN_REGISTRY: readonly ScreenRegistryEntry[] = [
  { id: "SCREEN-001", path: "/", label: "Home / Landing" },
  { id: "SCREEN-002", path: "/generate", label: "AI Portrait Generator" },
  { id: "SCREEN-003", path: "/gallery", label: "Public Gallery" },
  { id: "SCREEN-004", path: "/gallery/my", label: "My Gallery" },
  { id: "SCREEN-005", path: "/styles", label: "Styles Collection" },
  { id: "SCREEN-006", path: "/style", label: "Style (alias)" },
  { id: "SCREEN-007", path: "/template-studio", label: "AI Template Studio" },
  { id: "SCREEN-008", path: "/print-smart-form", label: "Print Smart Form Wizard" },
  {
    id: "SCREEN-009",
    path: "/print-smart-form/studio",
    label: "Print Smart Form Studio",
  },
  {
    id: "SCREEN-010",
    path: "/ai-photo-generator",
    label: "AI Photo Generator / Lookbook Wizard",
  },
  {
    id: "SCREEN-011",
    path: "/ai-photo-generator/studio",
    label: "AI Photo Generator Studio",
  },
  { id: "SCREEN-012", path: "/shorts", label: "Shorts Hub" },
  { id: "SCREEN-013", path: "/shorts/studio", label: "Shorts Studio" },
  { id: "SCREEN-014", path: "/pricing", label: "Pricing" },
  { id: "SCREEN-015", path: "/profile", label: "Profile / My Page" },
  { id: "SCREEN-016", path: "/mypage", label: "My Page (alias → profile)" },
  { id: "SCREEN-017", path: "/support", label: "Support" },
  { id: "SCREEN-018", path: "/terms", label: "Terms of Service" },
  { id: "SCREEN-019", path: "/privacy", label: "Privacy Policy" },
  { id: "SCREEN-020", path: "/terms-consent", label: "Terms Consent Gate" },
  { id: "SCREEN-021", path: "/auth/bridge", label: "Auth Bridge" },
  { id: "SCREEN-022", path: "/admin", label: "Admin Dashboard" },
  { id: "SCREEN-023", path: "/admin/promotions", label: "Admin Promotions" },
] as const;

/** Next ID to assign when adding a screen (do not recycle). */
export const NEXT_SCREEN_ID_NUMBER = 24;

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.split("?")[0]?.split("#")[0] || "/";
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.slice(0, -1);
  }
  return trimmed || "/";
}

/**
 * Resolve permanent Screen ID for a pathname.
 * Exact match wins; otherwise longest registered prefix (for future nested routes).
 */
export function resolveScreenId(pathname: string): string {
  const path = normalizePathname(pathname);

  const exact = SCREEN_REGISTRY.find((e) => e.path === path);
  if (exact) return exact.id;

  let best: ScreenRegistryEntry | null = null;
  for (const entry of SCREEN_REGISTRY) {
    if (entry.path === "/") continue;
    if (path === entry.path || path.startsWith(`${entry.path}/`)) {
      if (!best || entry.path.length > best.path.length) {
        best = entry;
      }
    }
  }
  return best?.id ?? "SCREEN-000";
}

export function getScreenEntry(
  pathname: string
): ScreenRegistryEntry | undefined {
  const id = resolveScreenId(pathname);
  return SCREEN_REGISTRY.find((e) => e.id === id);
}
