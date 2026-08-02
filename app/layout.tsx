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
};

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <FeedbackProvider>
        <CreditsProvider>
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
