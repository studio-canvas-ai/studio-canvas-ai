"use client";

import { useEffect, useState, type ReactNode, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Github,
  Twitter,
  Instagram,
  Mail,
  Phone,
  MapPin,
  Building2,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { DEFAULT_BUSINESS_INFO, type BusinessInfo } from "@/lib/business";

function BizRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-[11px] font-medium tracking-wide text-white/45 sm:w-28">
        {label}
      </dt>
      <dd className="min-w-0 text-[12px] leading-relaxed text-white/70 sm:text-[13px]">
        {children}
      </dd>
    </div>
  );
}

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
  hash?: string;
};

export default function Footer() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [biz, setBiz] = useState<BusinessInfo>(DEFAULT_BUSINESS_INFO);

  useEffect(() => {
    void fetch("/api/business")
      .then((r) => r.json())
      .then((d: BusinessInfo) => {
        if (d?.companyName) setBiz(d);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const scrollToHash = (hash: string) => {
    const id = hash.replace(/^#/, "");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    return false;
  };

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, link: FooterLink) => {
    if (!link.hash) return;
    if (pathname === "/" || pathname === "") {
      e.preventDefault();
      scrollToHash(link.hash);
    }
  };

  const footerSections: { title: string; links: FooterLink[] }[] = [
    {
      title: t.footer.product,
      links: [
        { label: t.footer.links.features, href: "/#creator", hash: "#creator" },
        { label: t.footer.links.stylePacks, href: "/#styles", hash: "#styles" },
        { label: t.footer.links.pricing, href: "/#pricing", hash: "#pricing" },
      ],
    },
    {
      title: t.footer.company,
      links: [
        { label: t.footer.links.about, href: "/#hero", hash: "#hero" },
        {
          label: t.footer.links.contact,
          href: `mailto:${biz.email}`,
          external: true,
        },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { label: t.footer.links.terms, href: "/terms" },
        { label: t.footer.links.privacy, href: "/privacy" },
      ],
    },
  ];

  const telHref = `tel:${biz.phone.replace(/-/g, "")}`;
  const linkClass =
    "text-sm text-white/40 transition-colors hover:text-white/70";

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
                  href={idx === 3 ? `mailto:${biz.email}` : "#"}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all duration-300 hover:border-white/20 hover:text-white"
                  aria-label={idx === 3 ? biz.email : undefined}
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
                  <li key={link.label}>
                    {link.external ? (
                      <a href={link.href} className={linkClass}>
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className={linkClass}
                        onClick={(e) => handleNavClick(e, link)}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/[0.06] pt-8">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-white/40" />
            <h3 className="text-sm font-medium text-white/65">{t.footer.businessHeading}</h3>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 lg:gap-x-10 lg:gap-y-3">
            <BizRow label="상호">{biz.companyName}</BizRow>
            <BizRow label={t.footer.ceo}>{biz.ceoName}</BizRow>
            <BizRow label={t.footer.businessNumber}>{biz.businessNumber}</BizRow>
            {biz.mailOrderNumber ? (
              <BizRow label={t.footer.mailOrder}>{biz.mailOrderNumber}</BizRow>
            ) : null}
            <BizRow label={t.footer.address}>
              <span className="inline-flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" />
                <span>{biz.address}</span>
              </span>
            </BizRow>
            <BizRow label={t.footer.contact}>
              <span className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                <a
                  href={`mailto:${biz.email}`}
                  className="inline-flex items-center gap-1.5 text-white/75 transition-colors hover:text-white"
                >
                  <Mail className="h-3.5 w-3.5 text-white/35" />
                  {biz.email}
                </a>
                <a
                  href={telHref}
                  className="inline-flex items-center gap-1.5 text-white/75 transition-colors hover:text-white"
                >
                  <Phone className="h-3.5 w-3.5 text-white/35" />
                  {biz.phone}
                </a>
              </span>
            </BizRow>
            {biz.hostingProvider ? (
              <BizRow label={t.footer.hosting}>{biz.hostingProvider}</BizRow>
            ) : null}
          </dl>
        </div>

        <div className="mt-10 border-t border-white/[0.06] pt-8">
          <p className="text-center text-xs text-white/30 sm:text-left">{t.footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
