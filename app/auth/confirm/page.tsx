import ConfirmAccountClient from "./ConfirmAccountClient";
import { safePostConsentPath } from "@/lib/termsConsent";

export const metadata = {
  title: "계정 확인 | Studio Canvas AI",
  description: "로그인에 사용된 소셜 계정을 확인합니다",
};

/**
 * /auth/* uses AuthShell (no CreditsProvider / I18nProvider).
 * Do not import Navbar/Footer here — they call useCredits/useI18n and crash.
 */
export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safePostConsentPath(
    typeof params.next === "string" ? params.next : null
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(0,0,0,0.9),_#050505)]"
      />
      <section className="relative z-10 w-full max-w-3xl">
        <ConfirmAccountClient nextPath={nextPath} />
      </section>
    </main>
  );
}
