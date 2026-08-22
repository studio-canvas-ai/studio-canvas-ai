import { google } from "googleapis";
import {
  getGoogleOAuthClientCredentials,
  getYoutubeOAuthRedirectUri,
  YOUTUBE_UPLOAD_SCOPES,
} from "@/lib/youtube/config";
import {
  clearYoutubeTokens,
  readYoutubeTokens,
  writeYoutubeTokens,
  type YoutubeTokenPayload,
} from "@/lib/youtube/tokenStore";

export function createYoutubeOAuth2Client(reqUrl?: string) {
  const creds = getGoogleOAuthClientCredentials();
  if (!creds) {
    throw new Error("youtube_oauth_not_configured");
  }
  return new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    getYoutubeOAuthRedirectUri(reqUrl)
  );
}

export function buildYoutubeAuthUrl(params: {
  userId: string;
  returnTo: string;
  reqUrl?: string;
}): string {
  const client = createYoutubeOAuth2Client(params.reqUrl);
  const state = Buffer.from(
    JSON.stringify({
      uid: params.userId,
      returnTo: params.returnTo.slice(0, 500),
      t: Date.now(),
    }),
    "utf8"
  ).toString("base64url");

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [...YOUTUBE_UPLOAD_SCOPES],
    state,
  });
}

export function parseYoutubeOAuthState(state: string | null): {
  uid: string;
  returnTo: string;
} | null {
  if (!state) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as { uid?: string; returnTo?: string };
    if (!parsed.uid) return null;
    const returnTo =
      typeof parsed.returnTo === "string" && parsed.returnTo.startsWith("/")
        ? parsed.returnTo
        : "/shorts/studio";
    return { uid: parsed.uid, returnTo };
  } catch {
    return null;
  }
}

export async function exchangeYoutubeCode(params: {
  code: string;
  userId: string;
  reqUrl?: string;
}): Promise<YoutubeTokenPayload> {
  const client = createYoutubeOAuth2Client(params.reqUrl);
  const { tokens } = await client.getToken(params.code);
  if (!tokens.access_token) {
    throw new Error("youtube_token_missing_access");
  }
  const existing = await readYoutubeTokens(params.userId);
  const refreshToken = tokens.refresh_token || existing?.refreshToken;
  if (!refreshToken) {
    throw new Error("youtube_token_missing_refresh");
  }
  const payload: YoutubeTokenPayload = {
    accessToken: tokens.access_token,
    refreshToken,
    expiryDate: tokens.expiry_date || Date.now() + 3500_000,
    scope: tokens.scope || YOUTUBE_UPLOAD_SCOPES.join(" "),
    userId: params.userId,
  };
  await writeYoutubeTokens(payload);
  return payload;
}

export type YoutubeAuthErrorCode =
  | "not_connected"
  | "token_expired"
  | "scope_missing"
  | "oauth_not_configured"
  | "refresh_failed";

export class YoutubeAuthError extends Error {
  code: YoutubeAuthErrorCode;
  constructor(code: YoutubeAuthErrorCode, message?: string) {
    super(message || code);
    this.code = code;
  }
}

/**
 * Returns an OAuth2 client with a fresh access token for the app user.
 */
export async function getAuthorizedYoutubeClient(params: {
  userId: string;
  reqUrl?: string;
}) {
  if (!getGoogleOAuthClientCredentials()) {
    throw new YoutubeAuthError("oauth_not_configured");
  }
  const stored = await readYoutubeTokens(params.userId);
  if (!stored?.refreshToken) {
    throw new YoutubeAuthError("not_connected");
  }

  const client = createYoutubeOAuth2Client(params.reqUrl);
  client.setCredentials({
    access_token: stored.accessToken,
    refresh_token: stored.refreshToken,
    expiry_date: stored.expiryDate,
    scope: stored.scope,
  });

  const needsRefresh =
    !stored.accessToken || stored.expiryDate < Date.now() + 60_000;

  if (needsRefresh) {
    try {
      const { credentials } = await client.refreshAccessToken();
      if (!credentials.access_token) {
        throw new YoutubeAuthError("refresh_failed");
      }
      const next: YoutubeTokenPayload = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || stored.refreshToken,
        expiryDate: credentials.expiry_date || Date.now() + 3500_000,
        scope: credentials.scope || stored.scope,
        userId: params.userId,
      };
      await writeYoutubeTokens(next);
      client.setCredentials({
        access_token: next.accessToken,
        refresh_token: next.refreshToken,
        expiry_date: next.expiryDate,
        scope: next.scope,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/invalid_grant|expired|revoked/i.test(msg)) {
        await clearYoutubeTokens();
        throw new YoutubeAuthError("token_expired", msg);
      }
      throw new YoutubeAuthError("refresh_failed", msg);
    }
  }

  const scope = stored.scope || "";
  if (
    scope &&
    !scope.includes("youtube.upload") &&
    !scope.includes("youtube.force-ssl") &&
    !scope.includes("youtube")
  ) {
    throw new YoutubeAuthError("scope_missing");
  }

  return client;
}

export async function getYoutubeConnectionStatus(userId: string): Promise<{
  connected: boolean;
  channelTitle: string | null;
}> {
  try {
    const auth = await getAuthorizedYoutubeClient({ userId });
    const youtube = google.youtube({ version: "v3", auth });
    const res = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
      maxResults: 1,
    });
    const title = res.data.items?.[0]?.snippet?.title || null;
    return { connected: true, channelTitle: title };
  } catch (err) {
    if (err instanceof YoutubeAuthError && err.code === "not_connected") {
      return { connected: false, channelTitle: null };
    }
    if (err instanceof YoutubeAuthError && err.code === "token_expired") {
      return { connected: false, channelTitle: null };
    }
    // Soft-fail status checks — still report connected if tokens exist.
    const stored = await readYoutubeTokens(userId);
    return { connected: Boolean(stored?.refreshToken), channelTitle: null };
  }
}
