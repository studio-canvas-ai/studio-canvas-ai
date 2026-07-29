"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LegalDocumentView from "@/components/LegalDocumentView";
import { useI18n } from "@/components/I18nProvider";
import { getPrivacyDocument } from "@/lib/legalContent";

export default function PrivacyPage() {
  const { locale, t } = useI18n();
  const doc = getPrivacyDocument(locale);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <LegalDocumentView doc={doc} backLabel={t.nav.home} />
      <Footer />
    </main>
  );
}
