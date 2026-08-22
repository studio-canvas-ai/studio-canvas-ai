/**
 * YouTube Data API / Google OAuth configuration (upload-only connect flow).
 */

export const YOUTUBE_UPLOAD_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
] as const;

export const YOUTUBE_OAUTH_COOKIE = "sca_yt_oauth_v1";

export type YoutubePrivacyStatus = "public" | "unlisted" | "private";

export function isYoutubePrivacyStatus(v: string): v is YoutubePrivacyStatus {
  return v === "public" || v === "unlisted" || v === "private";
}

export function getGoogleOAuthClientCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.YOUTUBE_GOOGLE_CLIENT_ID ||
    ""
  ).trim();
  const clientSecret = (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.YOUTUBE_GOOGLE_CLIENT_SECRET ||
    ""
  ).trim();
  if (!clientId || !clientSecret) return null;
  if (clientSecret === "[SENSITIVE]" || clientSecret === "SENSITIVE") return null;
  return { clientId, clientSecret };
}

export function isYoutubeApiConfigured(): boolean {
  return getGoogleOAuthClientCredentials() != null;
}

export function getYoutubeOAuthRedirectUri(reqUrl?: string): string {
  const fromEnv = (
    process.env.YOUTUBE_OAUTH_REDIRECT_URI ||
    process.env.GOOGLE_YOUTUBE_REDIRECT_URI ||
    ""
  ).trim();
  if (fromEnv) return fromEnv;

  const site = (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  ).replace(/\/$/, "");
  if (site) return `${site}/api/shorts/youtube/callback`;

  if (reqUrl) {
    try {
      const u = new URL(reqUrl);
      return `${u.origin}/api/shorts/youtube/callback`;
    } catch {
      /* ignore */
    }
  }
  return "http://localhost:3000/api/shorts/youtube/callback";
}
