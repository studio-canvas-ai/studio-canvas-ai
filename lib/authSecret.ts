import { randomBytes } from "node:crypto";

/**
 * Shared Auth.js signing secret for NextAuth handlers and /api/auth/supabase-bridge.
 * Both MUST use the same secret or minted session cookies will not validate.
 */

function resolveAuthSecret(): string | undefined {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || undefined;
}

const DEV_AUTH_SECRET = randomBytes(32).toString("base64url");

type GlobalSecret = typeof globalThis & {
  __scaAuthSecretCache?: string;
};

const g = globalThis as GlobalSecret;

export function requireAuthSecret(): string {
  const secret = resolveAuthSecret();
  if (secret) return secret;

  if (g.__scaAuthSecretCache) return g.__scaAuthSecretCache;

  if (process.env.NEXT_PHASE === "phase-production-build") {
    console.error(
      "[auth] AUTH_SECRET is not set. Set it in the deployment environment before serving traffic."
    );
    g.__scaAuthSecretCache = randomBytes(32).toString("hex");
    return g.__scaAuthSecretCache;
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "[auth] AUTH_SECRET (or NEXTAUTH_SECRET) is missing in production. " +
        "Sessions use an ephemeral secret; set AUTH_SECRET and redeploy."
    );
    g.__scaAuthSecretCache = randomBytes(32).toString("hex");
    return g.__scaAuthSecretCache;
  }

  g.__scaAuthSecretCache = DEV_AUTH_SECRET;
  return g.__scaAuthSecretCache;
}

export function hasConfiguredAuthSecret(): boolean {
  return Boolean(resolveAuthSecret());
}
