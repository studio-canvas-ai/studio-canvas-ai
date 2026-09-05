/**
 * Shorts / video-thumbnail feature — shared route constants.
 *
 * Phase 1: entry points (bottom tab, hero CTA) → this path.
 * Phase 2: gallery/PC video upload → Cloudflare R2 (`/api/shorts/presign`).
 * Later: AI hook-frame extraction, text edit studio.
 */

/** Canonical App Router path for the video / thumbnail workspace. */
export const SHORTS_THUMBNAIL_PATH = "/shorts";

/** Hybrid dual studio (legacy single editor: /shorts/studio?legacy=1). */
export const SHORTS_STUDIO_PATH = "/shorts/studio";

/** Query alias kept for deep-links; middleware/page may normalize to SHORTS_THUMBNAIL_PATH. */
export const SHORTS_MODE_QUERY = "mode=video" as const;
