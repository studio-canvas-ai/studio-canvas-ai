"use client";

import { useEffect, type ReactNode } from "react";
import { Building2, Mail, Phone, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import type { BusinessInfo } from "@/lib/business";

export default function AboutCompanyModal({
  open,
  onClose,
  business,
}: {
  open: boolean;
  onClose: () => void;
  business: BusinessInfo;
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const telHref = `tel:${business.phone.replace(/-/g, "")}`;
  const rows: { label: string; value: ReactNode }[] = [
    { label: t.aboutCompany.companyName, value: business.companyName },
    { label: t.aboutCompany.ceo, value: business.ceoName },
    { label: t.aboutCompany.businessNumber, value: business.businessNumber },
    { label: t.aboutCompany.mailOrder, value: business.mailOrderNumber },
    { label: t.aboutCompany.address, value: business.address },
    {
      label: t.aboutCompany.email,
      value: (
        <a
          href={`mailto:${business.email}`}
          className="inline-flex items-center gap-1.5 text-white/80 transition hover:text-white"
        >
          <Mail className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden />
          {business.email}
        </a>
      ),
    },
    {
      label: t.aboutCompany.phone,
      value: (
        <a
          href={telHref}
          className="inline-flex items-center gap-1.5 text-white/80 transition hover:text-white"
        >
          <Phone className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden />
          {business.phone}
        </a>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
        aria-label={t.common.close}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-company-title"
        className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/12 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
        style={{
          background:
            "linear-gradient(165deg, #1a2235 0%, #121829 48%, #0f1420 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald">
              <Building2 className="h-5 w-5 text-white" aria-hidden />
            </div>
            <h2
              id="about-company-title"
              className="font-display text-lg font-semibold tracking-tight text-white sm:text-xl"
            >
              {t.aboutCompany.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
            aria-label={t.common.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="space-y-4">
            <p className="text-[15px] leading-7 text-white/70">{t.aboutCompany.p1}</p>
            <p className="text-[15px] leading-7 text-white/70">{t.aboutCompany.p2}</p>
          </div>

          <section className="mt-8">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-white/45 uppercase">
              {t.aboutCompany.businessHeading}
            </h3>
            <dl className="space-y-2.5 rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="grid gap-1 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-3"
                >
                  <dt className="text-xs text-white/40 sm:pt-0.5">{row.label}</dt>
                  <dd className="text-sm leading-relaxed text-white/80">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
