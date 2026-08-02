"use client";

import SupportTicketForm from "@/components/SupportTicketForm";
import { useI18n } from "@/components/I18nProvider";

export default function SupportPageClient() {
  const { t } = useI18n();
  return (
    <section className="section-padding mx-auto max-w-2xl pt-28">
      <h1 className="font-display mb-2 text-3xl font-bold">{t.support.title}</h1>
      <p className="mb-8 text-sm text-white/50">{t.support.subtitle}</p>
      <SupportTicketForm />
    </section>
  );
}
