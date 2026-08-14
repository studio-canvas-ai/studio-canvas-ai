/**
 * Root layout — CSS MUST be the first import so App Router injects Tailwind
 * before any client components. Do not add <head>/<link> stylesheet tags here;
 * they can block Next.js CSS chunks and cause unstyled layouts.
 */
import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Playfair_Display } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import { CreditsProvider } from "@/components/CreditsProvider";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import AuthModal from "@/components/AuthModal";
import SupabaseAuthBootstrap from "@/components/SupabaseAuthBootstrap";
import CreditDepletionModal from "@/components/CreditDepletionModal";
import PaymentModal from "@/components/PaymentModal";
import CreditTopUpModal from "@/components/CreditTopUpModal";
import ReturnUserModal from "@/components/ReturnUserModal";
import PromotionCodeModal from "@/components/PromotionCodeModal";
import GoogleFontsLoader from "@/components/GoogleFontsLoader";
import { PRODUCTION_SITE_URL } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});

const siteDescription =
  "Transform selfies into editorial-quality portraits with AI. Premium studio aesthetics and bespoke style packs.";

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_SITE_URL),
  title: "Studio Canvas AI — Your Personal AI Portrait Studio",
  description: siteDescription,
  applicationName: "Studio Canvas AI",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/icon.png", type: "image/png", sizes: "180x180" }],
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0D0E12" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0E12" },
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: PRODUCTION_SITE_URL,
    siteName: "Studio Canvas AI",
    title: "Studio Canvas AI — Your Personal AI Portrait Studio",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Studio Canvas AI — Your Personal AI Portrait Studio",
    description: siteDescription,
  },
  appleWebApp: {
    capable: true,
    title: "Studio Canvas AI",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <FeedbackProvider>
        <CreditsProvider>
          <SupabaseAuthBootstrap />
          {children}
          <AuthModal />
          <CreditDepletionModal />
          <PaymentModal />
          <CreditTopUpModal />
          <ReturnUserModal />
          <PromotionCodeModal />
        </CreditsProvider>
      </FeedbackProvider>
    </AuthSessionProvider>
  );
}

/** Lightweight shell for /auth/* — avoids Session/Credits providers hanging SSR. */
function AuthShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const pathname = headerList.get("x-sca-pathname") || "";
  const isAuthRoute = pathname.startsWith("/auth/");

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full`}
      style={{ backgroundColor: "#0D0E12" }}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-navy font-sans text-white antialiased"
        style={{ backgroundColor: "#0D0E12", color: "#ffffff" }}
      >
        {/*
          Kakao SDK is NOT loaded/initialized here.
          Share-only path: lib/kakaoShare.ts loads SDK on demand so auth/session
          and YouTube share never share a global Kakao.init side channel.
        */}
        <GoogleFontsLoader />
        {isAuthRoute ? (
          <AuthShell>{children}</AuthShell>
        ) : (
          <I18nProvider>
            <AppShell>{children}</AppShell>
          </I18nProvider>
        )}
      </body>
    </html>
  );
}
