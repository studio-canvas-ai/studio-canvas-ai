import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { CreditsProvider } from "@/components/CreditsProvider";
import AuthModal from "@/components/AuthModal";
import CreditDepletionModal from "@/components/CreditDepletionModal";
import PaymentModal from "@/components/PaymentModal";
import CreditTopUpModal from "@/components/CreditTopUpModal";
import ReturnUserModal from "@/components/ReturnUserModal";
import GoogleFontsLoader from "@/components/GoogleFontsLoader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Studio Canvas AI — Your Personal AI Portrait Studio",
  description:
    "Transform selfies into editorial-quality portraits with AI. Premium studio aesthetics and bespoke style packs.",
};

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CreditsProvider>
      {children}
      <AuthModal />
      <CreditDepletionModal />
      <PaymentModal />
      <CreditTopUpModal />
      <ReturnUserModal />
    </CreditsProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full`}
      style={{ backgroundColor: "#0D0E12" }}
    >
      <body
        className="min-h-full bg-navy font-sans text-white antialiased"
        style={{ backgroundColor: "#0D0E12", color: "#ffffff" }}
      >
        <GoogleFontsLoader />
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
