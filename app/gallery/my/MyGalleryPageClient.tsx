"use client";

import MyGalleryTabs from "@/components/MyGalleryTabs";
import { useI18n } from "@/components/I18nProvider";

export default function MyGalleryPageClient() {
  const { t } = useI18n();
  return (
    <section className="section-padding mx-auto max-w-5xl pt-28">
      <h1 className="font-display mb-2 text-3xl font-bold">{t.gallery.myGalleryTitle}</h1>
      <p className="mb-8 text-sm text-white/50">{t.gallery.myGallerySubtitle}</p>
      <MyGalleryTabs />
    </section>
  );
}
