import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";
import { requireAuthSecret } from "@/lib/authSecret";
import { YOUTUBE_OAUTH_COOKIE } from "@/lib/youtube/config";

export type YoutubeTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  scope?: string;
  userId: string;
};

function keyBytes(): Buffer {
  return createHash("sha256").update(requireAuthSecret()).digest();
}

export function encryptYoutubeTokens(payload: YoutubeTokenPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

export function decryptYoutubeTokens(
  raw: string | undefined | null
): YoutubeTokenPayload | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const data = Buffer.from(parts[2], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    const parsed = JSON.parse(plain.toString("utf8")) as YoutubeTokenPayload;
    if (
      !parsed?.accessToken ||
      !parsed?.refreshToken ||
      !parsed?.userId ||
      !Number.isFinite(parsed.expiryDate)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function readYoutubeTokens(
  expectedUserId?: string | null
): Promise<YoutubeTokenPayload | null> {
  try {
    const jar = await cookies();
    const parsed = decryptYoutubeTokens(jar.get(YOUTUBE_OAUTH_COOKIE)?.value);
    if (!parsed) return null;
    if (expectedUserId && parsed.userId !== expectedUserId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeYoutubeTokens(
  payload: YoutubeTokenPayload
): Promise<void> {
  const jar = await cookies();
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.AUTH_URL?.startsWith("https://") === true;
  jar.set(YOUTUBE_OAUTH_COOKIE, encryptYoutubeTokens(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearYoutubeTokens(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(YOUTUBE_OAUTH_COOKIE);
  } catch {
    /* ignore */
  }
}
