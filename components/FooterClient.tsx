"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Instagram, Mail, Sparkles, Twitter } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { SOCIAL_LINKS } from "@/lib/social";

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
  hash?: string;
};

type SocialItem = {
  Icon: typeof Twitter;
  href: string;
  label: string;
  external: boolean;
};

/**
 * Interactive footer chrome (i18n nav + hash scroll).
 * Merchant disclosure is injected as a Server Component slot so PG scanners
 * see business fields in the raw HTML without client fetch.
 */
export default function FooterClient({
  businessSlot,
  contactEmail,
}: {
  businessSlot: ReactNode;
  contactEmail: string;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

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
          href: `mailto:${contactEmail}`,
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

  const communityExternal = /^https?:\/\//i.test(SOCIAL_LINKS.community);
  const socialItems: SocialItem[] = [
    {
      Icon: Twitter,
      href: SOCIAL_LINKS.twitter,
      label: "Twitter / X",
      external: true,
    },
    {
      Icon: Instagram,
      href: SOCIAL_LINKS.instagram,
      label: "Instagram",
      external: true,
    },
    {
      Icon: Github,
      href: SOCIAL_LINKS.community,
      label: "Community",
      external: communityExternal,
    },
    {
      Icon: Mail,
      href: `mailto:${contactEmail}`,
      label: contactEmail,
      external: true,
    },
  ];

  const linkClass = "text-sm text-zinc-300 transition-colors hover:text-white";
  const socialClass =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 text-zinc-300 transition-all duration-300 hover:border-white/50 hover:text-white";

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
                <span className="ml-2 text-[10px] tracking-[0.2em] text-zinc-300 uppercase">
                  AI
                </span>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-300">
              {t.footer.tagline1}
              <br />
              {t.footer.tagline2}
            </p>
            <div className="mt-6 flex gap-3">
              {socialItems.map(({ Icon, href, label, external }) =>
                external ? (
                  <a
                    key={label}
                    href={href}
                    className={socialClass}
                    aria-label={label}
                    {...(href.startsWith("mailto:")
                      ? {}
                      : { target: "_blank", rel: "noopener noreferrer" })}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ) : (
                  <Link key={label} href={href} className={socialClass} aria-label={label}>
                    <Icon className="h-4 w-4" />
                  </Link>
                )
              )}
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="mb-4 text-sm font-semibold text-white">{section.title}</h4>
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

        {businessSlot}

        <div className="mt-10 border-t border-white/[0.06] pt-8">
          <p className="text-center text-xs text-zinc-300 sm:text-left">{t.footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
