/**
 * Public social / community destinations for the site footer.
 * Override via NEXT_PUBLIC_SOCIAL_* when official handles change.
 */
export const SOCIAL_LINKS = {
  twitter:
    process.env.NEXT_PUBLIC_SOCIAL_TWITTER_URL?.trim() ||
    "https://x.com/StudioCanvasAI",
  instagram:
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL?.trim() ||
    "https://www.instagram.com/studiocanvasai",
  /** Community channel (Discord / Kakao open chat / forum). Falls back to Support. */
  community:
    process.env.NEXT_PUBLIC_SOCIAL_COMMUNITY_URL?.trim() || "/support",
} as const;
