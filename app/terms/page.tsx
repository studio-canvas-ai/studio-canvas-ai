"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LegalDocumentView from "@/components/LegalDocumentView";
import { useI18n } from "@/components/I18nProvider";
import { getTermsDocument } from "@/lib/legalContent";

export default function TermsPage() {
  const { locale, t } = useI18n();
  const doc = getTermsDocument(locale);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <LegalDocumentView doc={doc} backLabel={t.nav.home} />
      <Footer />
    </main>
  );
}
