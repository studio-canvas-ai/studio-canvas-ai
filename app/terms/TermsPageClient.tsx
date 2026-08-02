"use client";

import LegalDocumentView from "@/components/LegalDocumentView";
import { useI18n } from "@/components/I18nProvider";
import { getTermsDocument } from "@/lib/legalContent";

export default function TermsPageClient() {
  const { locale, t } = useI18n();
  const doc = getTermsDocument(locale);
  return <LegalDocumentView doc={doc} backLabel={t.nav.home} />;
}
