"use client";

import LegalDocumentView from "@/components/LegalDocumentView";
import { useI18n } from "@/components/I18nProvider";
import { getPrivacyDocument } from "@/lib/legalContent";

export default function PrivacyPageClient() {
  const { locale, t } = useI18n();
  const doc = getPrivacyDocument(locale);
  return <LegalDocumentView doc={doc} backLabel={t.nav.home} />;
}
