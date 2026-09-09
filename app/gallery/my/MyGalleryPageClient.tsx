"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import MyGalleryTabs from "@/components/MyGalleryTabs";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";

/**
 * Gallery layout is auth-provider agnostic: same wide shell for Google / Naver /
 * Kakao / email / any other sign-in method. Do not branch styles on provider.
 */
export default function MyGalleryPageClient() {
  const { t } = useI18n();
  const router = useRouter();
  const { isAuthenticated } = useCredits();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <section
      data-gallery-shell="wide"
      className="page-below-nav w-full px-4 pb-10 sm:px-6 md:px-8 lg:px-10"
    >
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="pt-3 sm:pt-4">
          <h1 className="font-display mb-1.5 text-3xl font-bold">
            {t.gallery.myGalleryTitle}
          </h1>
          <p className="mb-6 text-sm text-white/50">
            {t.gallery.myGallerySubtitle}
          </p>
        </div>
        <Suspense fallback={null}>
          <MyGalleryTabs />
        </Suspense>
      </div>
    </section>
  );
}
