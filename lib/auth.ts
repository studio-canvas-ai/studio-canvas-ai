import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Credentials from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers";
import { findOrCreateOAuthUser } from "@/lib/db/credits";
import type { AuthProviderId } from "@/lib/db/types";

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
      })
    );
  }
  if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
    list.push(NaverProvider());
  }

  // Always available for local / demo email signup → grants FREE_CREDITS via findOrCreate
  list.push(
    Credentials({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "")
          .trim()
          .toLowerCase();
        if (!email || !email.includes("@")) return null;
        const { user } = await findOrCreateOAuthUser({
          provider: "credentials",
          providerAccountId: email,
          email,
          name: email.split("@")[0],
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

  return list;
}

export const authConfigured = () =>
  Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-only-studio-canvas-secret-change-me",
  trustHost: true,
  providers: buildProviders(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/generate",
    error: "/generate",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false;
      if (account.provider === "credentials") return true;
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
    async jwt({ token, account, user }) {
      if (account && user) {
        if (account.provider === "credentials") {
          token.uid = user.id;
          const { getUserById } = await import("@/lib/db/credits");
          const dbUser = await getUserById(user.id!);
          if (dbUser) {
            token.credits = dbUser.credits;
            token.planId = dbUser.planId;
          }
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
          token.credits = dbUser.credits;
          token.planId = dbUser.planId;
        }
      } else if (token.uid) {
        const { getUserById } = await import("@/lib/db/credits");
        const dbUser = await getUserById(token.uid as string);
        if (dbUser) {
          token.credits = dbUser.credits;
          token.planId = dbUser.planId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.uid as string;
        (session as { credits?: number }).credits = token.credits as number;
        (session as { planId?: string }).planId = token.planId as string;
      }
      return session;
    },
  },
});

export function listSocialProviders(): AuthProviderId[] {
  const out: AuthProviderId[] = [];
  if (process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_SECRET) out.push("kakao");
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) out.push("google");
  if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) out.push("naver");
  return out;
}
