import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Facebook from "next-auth/providers/facebook";
import Instagram from "next-auth/providers/instagram";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers";
import { findOrCreateOAuthUser } from "@/lib/db/credits";
import type { AuthProviderId } from "@/lib/db/types";
import {
  isSupabaseConfigured,
  getSupabaseUrl,
  getSupabaseAnonKey,
} from "@/lib/supabase/config";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import {
  extractSupabaseOAuthProfile,
  SUPABASE_SOCIAL_PROVIDERS,
} from "@/lib/supabase/oauth";
import { authJsCookiesConfig } from "@/lib/authCookies";
import { hasConfiguredAuthSecret, requireAuthSecret } from "@/lib/authSecret";
import { isPrivilegedAdminEmail } from "@/lib/unlimitedAccount";

type NaverProfile = {
  resultcode: string;
  message: string;
  response: {
    id: string;
    email?: string;
    nickname?: string;
    name?: string;
    profile_image?: string;
  };
};

function NaverProvider(): OAuthConfig<NaverProfile> {
  return {
    id: "naver",
    name: "Naver",
    type: "oauth",
    authorization: {
      url: "https://nid.naver.com/oauth2.0/authorize",
      params: { response_type: "code" },
    },
    token: "https://nid.naver.com/oauth2.0/token",
    userinfo: "https://openapi.naver.com/v1/nid/me",
    clientId: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
    profile(profile) {
      const p = profile.response;
      return {
        id: p.id,
        name: p.name ?? p.nickname ?? null,
        email: p.email ?? null,
        image: p.profile_image ?? null,
      };
    },
    style: { bg: "#03C75A", text: "#fff" },
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/** Admin accounts must come from a real OAuth identity, never passwordless email. */
function isAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (isPrivilegedAdminEmail(normalized)) return true;
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

/** Passwordless email login is a dev-only convenience. */
function credentialsSignupEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.ALLOW_CREDENTIALS_SIGNUP === "true";
  }
  return true;
}

function buildProviders() {
  const list = [];
  if (process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_SECRET) {
    list.push(
      Kakao({
        clientId: process.env.KAKAO_CLIENT_ID,
        clientSecret: process.env.KAKAO_CLIENT_SECRET,
      })
    );
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    list.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            scope: "openid email profile",
            // Always show the Google account picker (avoid sticky deleted/wrong channel).
            prompt: "select_account",
            access_type: "offline",
          },
        },
      })
    );
  }

  // Bridge: Supabase Auth (Google etc.) → app user DB → NextAuth JWT session
  if (isSupabaseConfigured()) {
    list.push(
      Credentials({
        id: "supabase",
        name: "Supabase",
        credentials: {
          accessToken: { label: "Access Token", type: "text" },
        },
        async authorize(credentials) {
          const accessToken = String(credentials?.accessToken || "").trim();
          if (!accessToken) return null;

          const url = getSupabaseUrl();
          const anon = getSupabaseAnonKey();
          if (!url || !anon) return null;

          const supabase = createSupabaseAdminClient(url, anon, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser(accessToken);
          if (error || !user) return null;

          const profile = extractSupabaseOAuthProfile(user);

          const { user: dbUser } = await findOrCreateOAuthUser({
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
            email: profile.email,
            name: profile.name,
            image: profile.image,
          });

          try {
            const { upsertProfileWithAccessToken } = await import(
              "@/lib/supabase/profile"
            );
            await upsertProfileWithAccessToken(accessToken, {
              id: user.id,
              email: profile.email,
              name: profile.name,
              avatarUrl: profile.image,
              appUserId: dbUser.id,
            });
          } catch {
            /* profile sync must never block login */
          }

          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            image: dbUser.image,
          };
        },
      })
    );
  }

  if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
    list.push(NaverProvider());
  }
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    list.push(
      MicrosoftEntraID({
        id: "microsoft",
        name: "Microsoft",
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        issuer:
          process.env.MICROSOFT_ISSUER ||
          "https://login.microsoftonline.com/common/v2.0",
      })
    );
  }
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    list.push(
      Facebook({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      })
    );
  }
  if (process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET) {
    list.push(
      Instagram({
        clientId: process.env.INSTAGRAM_CLIENT_ID,
        clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
      })
    );
  }

  if (process.env.NODE_ENV !== "production") {
    list.push(
      Credentials({
        id: "google-mock",
        name: "Google Mock",
        credentials: {
          email: { label: "Email", type: "email" },
        },
        async authorize() {
          const email = "test@gmail.com";
          const { user } = await findOrCreateOAuthUser({
            provider: "google-mock",
            providerAccountId: email,
            email,
            name: "Google Test User",
          });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        },
      })
    );
  }

  // Email sign-up is a local/demo convenience only: it has no password store, so it
  // must never be reachable in production or with a shared-secret deployment.
  if (credentialsSignupEnabled()) {
    list.push(
      Credentials({
        id: "credentials",
        name: "Email",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
          name: { label: "Name", type: "text" },
        },
        async authorize(credentials) {
          const email = String(credentials?.email || "")
            .trim()
            .toLowerCase();
          if (!isValidEmail(email)) return null;
          if (isAdminEmail(email)) return null;
          const displayName = String(credentials?.name || "")
            .trim()
            .slice(0, 80);
          const { user } = await findOrCreateOAuthUser({
            provider: "credentials",
            providerAccountId: email,
            email,
            name: displayName || email.split("@")[0],
          });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        },
      })
    );
  }

  return list;
}

export const authConfigured = () => hasConfiguredAuthSecret();

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: requireAuthSecret(),
  // Prefer AUTH_URL / NEXTAUTH_URL = https://www.studio-canvas-ai.com in production.
  // trustHost allows Auth.js to honor the request Host (custom domain) when set.
  trustHost: true,
  providers: buildProviders(),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  // Avoid `__Host-` CSRF cookies (often rejected on custom domains after OAuth redirects).
  cookies: authJsCookiesConfig(),
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false;
      if (
        account.provider === "credentials" ||
        account.provider === "google-mock" ||
        account.provider === "supabase"
      ) {
        return true;
      }
      const provider = account.provider as AuthProviderId;
      await findOrCreateOAuthUser({
        provider,
        providerAccountId: account.providerAccountId,
        email: user.email,
        name: user.name,
        image: user.image,
      });
      return true;
    },
    async jwt({ token, account, user, trigger }) {
      const PLAN_CACHE_MS = Number(
        process.env.JWT_PLAN_CACHE_MS || 15 * 60 * 1000
      );

      const applyDbUser = (dbUser: {
        credits: number;
        planId: string;
        currentPeriodEnd?: number;
        provider?: string;
        providerAccountId?: string;
      }) => {
        token.credits = dbUser.credits;
        token.planId = dbUser.planId;
        token.currentPeriodEnd = dbUser.currentPeriodEnd ?? null;
        token.planCachedAt = Date.now();
        if (dbUser.provider) token.authProvider = dbUser.provider;
        if (dbUser.providerAccountId) {
          token.providerAccountId =
            token.providerAccountId || dbUser.providerAccountId;
        }
      };

      if (account && user) {
        token.authProvider = account.provider;
        if (
          account.provider === "credentials" ||
          account.provider === "google-mock" ||
          account.provider === "supabase"
        ) {
          token.uid = user.id;
          if (account.providerAccountId) {
            token.providerAccountId = account.providerAccountId;
          } else if (user.email) {
            token.providerAccountId = user.email;
          }
          const { getUserById } = await import("@/lib/db/credits");
          const dbUser = await getUserById(user.id!);
          if (dbUser) applyDbUser(dbUser);
        } else {
          const provider = account.provider as AuthProviderId;
          const { user: dbUser } = await findOrCreateOAuthUser({
            provider,
            providerAccountId: account.providerAccountId,
            email: user.email,
            name: user.name,
            image: user.image,
          });
          token.uid = dbUser.id;
          token.providerAccountId = account.providerAccountId;
          applyDbUser(dbUser);
        }
      } else if (token.uid) {
        // Force refresh after explicit session update (e.g. payment).
        const force = trigger === "update";
        const cachedAt =
          typeof token.planCachedAt === "number" ? token.planCachedAt : 0;
        const stale = force || Date.now() - cachedAt > PLAN_CACHE_MS;
        if (stale) {
          const { getUserById } = await import("@/lib/db/credits");
          const dbUser = await getUserById(token.uid as string);
          if (dbUser) applyDbUser(dbUser);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.uid as string;
        (session as { credits?: number }).credits = token.credits as number;
        (session as { planId?: string }).planId = token.planId as string;
        (session as { currentPeriodEnd?: number | null }).currentPeriodEnd =
          (token.currentPeriodEnd as number | null | undefined) ?? null;
        (session as { authProvider?: string }).authProvider =
          token.authProvider as string;
      }
      return session;
    },
  },
});

export function listSocialProviders(): AuthProviderId[] {
  if (isSupabaseConfigured()) {
    // All social buttons route through Supabase Auth when the project is wired up.
    return [...SUPABASE_SOCIAL_PROVIDERS];
  }

  const out: AuthProviderId[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) out.push("google");
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) out.push("microsoft");
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) out.push("facebook");
  if (process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET) out.push("instagram");
  if (process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_SECRET) out.push("kakao");
  if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) out.push("naver");
  return out;
}
