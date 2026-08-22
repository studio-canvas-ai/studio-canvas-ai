import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TermsConsentForm from "@/components/TermsConsentForm";
import { authSessionCookieName } from "@/lib/authCookies";
import { safePostConsentPath } from "@/lib/termsConsent";

export const metadata = {
  title: "약관 동의 | Studio Canvas AI",
  description: "이용약관 및 개인정보처리방침 동의",
};

export default async function TermsConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safePostConsentPath(
    typeof params.next === "string" ? params.next : null
  );

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) {
    const cookieStore = await cookies();
    const cookieName = authSessionCookieName();
    const raw = cookieStore.get(cookieName)?.value;

    if (!raw) {
      redirect(`/generate?authError=${encodeURIComponent("sign_in_required")}`);
    }

    const token = await decode({
      token: raw,
      secret,
      salt: cookieName,
    });

    if (!token) {
      redirect(`/generate?authError=${encodeURIComponent("sign_in_required")}`);
    }

    // Already registered — skip the form.
    if (token.termsAgreed === true) {
      redirect(nextPath);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(0,0,0,0.9),_#050505)]"
      />
      <Navbar />
      <section className="relative z-10 mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 pb-16 pt-28">
        <TermsConsentForm nextPath={nextPath} />
      </section>
      <Footer />
    </main>
  );
}
