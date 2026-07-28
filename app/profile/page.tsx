"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FaceProfilePanel from "@/components/FaceProfilePanel";
import { useI18n } from "@/components/I18nProvider";

export default function ProfilePage() {
  const { t } = useI18n();
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <section className="section-padding mx-auto max-w-3xl pt-28">
        <h1 className="font-display mb-2 text-3xl font-bold">{t.profiles.title}</h1>
        <p className="mb-8 text-sm text-white/50">{t.returnUser.dataKept}</p>
        <FaceProfilePanel />
      </section>
      <Footer />
    </main>
  );
}
