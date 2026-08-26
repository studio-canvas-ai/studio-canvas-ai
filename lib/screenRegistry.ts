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
  /**
   * Internal step when one URL hosts multiple screens (e.g. wizard draft vs editor).
   * Omit or `1` for the default/first step on that path.
   */
  step?: number;
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
  {
    id: "SCREEN-008",
    path: "/print-smart-form",
    label: "Print Smart Form — Draft (Step 1)",
    step: 1,
  },
  {
    id: "SCREEN-009",
    path: "/print-smart-form/studio",
    label: "Print Smart Form Studio",
  },
  {
    id: "SCREEN-010",
    path: "/ai-photo-generator",
    label: "AI Photo Generator — Draft (Step 1)",
    step: 1,
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
  {
    id: "SCREEN-024",
    path: "/print-smart-form",
    label: "Print Smart Form — Editor / Complete (Step 2)",
    step: 2,
  },
  {
    id: "SCREEN-025",
    path: "/ai-photo-generator",
    label: "AI Photo Generator — Editor / Complete (Step 2)",
    step: 2,
  },
  {
    id: "SCREEN-026",
    path: "/print-unified-editor",
    label: "Print Unified Editor — One-page canvas + design tools",
  },
] as const;

/** Next ID to assign when adding a screen (do not recycle). */
export const NEXT_SCREEN_ID_NUMBER = 27;

/** Paths that share one URL across internal wizard steps. */
const STEPPED_PATH_SESSION_KEYS: Readonly<Record<string, readonly string[]>> = {
  "/print-smart-form": [
    "sca_print_wizard_v5",
    "sca_print_wizard_v4",
    "sca_print_wizard_v3",
  ],
  "/ai-photo-generator": ["sca_photo_wizard_v1"],
};

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.split("?")[0]?.split("#")[0] || "/";
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.slice(0, -1);
  }
  return trimmed || "/";
}

function entryStep(entry: ScreenRegistryEntry): number {
  return entry.step ?? 1;
}

/**
 * Read internal wizard step from sessionStorage for stepped home paths.
 * Returns `undefined` when the path is not stepped or no session exists.
 */
export function readInternalScreenStep(pathname: string): number | undefined {
  if (typeof window === "undefined") return undefined;
  const path = normalizePathname(pathname);
  const keys = STEPPED_PATH_SESSION_KEYS[path];
  if (!keys) return undefined;
  try {
    for (const key of keys) {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { wizardStep?: unknown };
      if (parsed.wizardStep === 2) return 2;
      if (parsed.wizardStep === 1) return 1;
      return 1;
    }
  } catch {
    /* ignore */
  }
  return 1;
}

export type ResolveScreenIdOptions = {
  /** Internal step (1 = draft, 2 = editor/complete). Defaults via session or 1. */
  step?: number;
};

/**
 * Resolve permanent Screen ID for a pathname (+ optional internal step).
 * Exact path+step match wins; otherwise longest registered prefix.
 */
export function resolveScreenId(
  pathname: string,
  options?: ResolveScreenIdOptions
): string {
  const path = normalizePathname(pathname);
  const step = Math.max(1, Math.floor(options?.step ?? 1));

  const pathMatches = SCREEN_REGISTRY.filter((e) => e.path === path);
  if (pathMatches.length) {
    const stepped = pathMatches.find((e) => entryStep(e) === step);
    if (stepped) return stepped.id;
    const fallback =
      pathMatches.find((e) => entryStep(e) === 1) ?? pathMatches[0];
    return fallback!.id;
  }

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
  pathname: string,
  options?: ResolveScreenIdOptions
): ScreenRegistryEntry | undefined {
  const id = resolveScreenId(pathname, options);
  return SCREEN_REGISTRY.find((e) => e.id === id);
}
