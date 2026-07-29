"use client";

import { useEffect, useState } from "react";
import { Sparkles, Github, Twitter, Instagram, Mail } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import type { BusinessInfo } from "@/lib/business";

export default function Footer() {
  const { t } = useI18n();
  const [biz, setBiz] = useState<BusinessInfo | null>(null);

  useEffect(() => {
    void fetch("/api/business")
      .then((r) => r.json())
      .then((d: BusinessInfo) => setBiz(d))
      .catch(() => setBiz(null));
  }, []);

  const footerSections = [
    {
      title: t.footer.product,
      links: [
        t.footer.links.features,
        t.footer.links.stylePacks,
        t.footer.links.pricing,
        t.footer.links.api,
      ],
    },
    {
      title: t.footer.company,
      links: [
        t.footer.links.about,
        t.footer.links.blog,
        t.footer.links.careers,
        t.footer.links.contact,
      ],
    },
    {
      title: t.footer.legal,
      links: [
        t.footer.links.terms,
        t.footer.links.privacy,
        t.footer.links.cookies,
      ],
    },
  ];

  return (
    <footer className="border-t border-white/[0.06] bg-navy-light/50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="font-display text-lg font-semibold">Studio Canvas</span>
                <span className="ml-2 text-[10px] tracking-[0.2em] text-white/30 uppercase">
                  AI
                </span>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/40">
              {t.footer.tagline1}
              <br />
              {t.footer.tagline2}
            </p>
            <div className="mt-6 flex gap-3">
              {[Twitter, Instagram, Github, Mail].map((Icon, idx) => (
                <a
                  key={idx}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all duration-300 hover:border-white/20 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="mb-4 text-sm font-medium text-white/70">{section.title}</h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-white/40 transition-colors hover:text-white/70"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {biz && (
          <div className="mt-10 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[11px] leading-relaxed text-white/40 sm:p-5">
            <p className="mb-2 text-xs font-medium text-white/55">{t.footer.businessHeading}</p>
            <div className="grid gap-1 sm:grid-cols-2">
              <p>
                {biz.companyName} · {t.footer.ceo} {biz.ceoName}
              </p>
              <p>
                {t.footer.businessNumber} {biz.businessNumber}
              </p>
              <p>
                {t.footer.mailOrder} {biz.mailOrderNumber}
              </p>
              <p>
                {t.footer.address} {biz.address}
              </p>
              <p>
                {t.footer.contact} {biz.email} / {biz.phone}
              </p>
              <p>
                {t.footer.hosting} {biz.hostingProvider}
              </p>
            </div>
          </div>
        )}

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row">
          <p className="text-xs text-white/30">{t.footer.copyright}</p>
          <p className="text-xs text-white/20">{t.footer.madeWith}</p>
        </div>
      </div>
    </footer>
  );
}
