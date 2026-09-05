"use client";

import { useState, useRef, useEffect, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  Github,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Twitter,
} from "lucide-react";
import AboutCompanyModal from "@/components/AboutCompanyModal";
import { useI18n } from "@/components/I18nProvider";
import type { BusinessInfo } from "@/lib/business";
import { SOCIAL_LINKS } from "@/lib/social";

type FooterLinkItem = {
  label: string;
  href: string;
  external?: boolean;
  hash?: string;
  action?: "about";
};

type SocialItem = {
  Icon: typeof Twitter;
  href: string;
  label: string;
  external: boolean;
};

type CategoryId = "product" | "company" | "legal" | "business";

type FooterCategory = {
  id: CategoryId;
  title: string;
  links?: FooterLinkItem[];
  isBusiness?: boolean;
};

/** Smooth height-based accordion panel */
function AccordionPanel({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    if (open) {
      setHeight(ref.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [open]);

  return (
    <div
      style={{ height, overflow: "hidden", transition: "height 220ms ease" }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

export default function FooterClient({
  businessSlot,
  contactEmail,
  business,
}: {
  businessSlot: ReactNode;
  contactEmail: string;
  business: BusinessInfo;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [openCategory, setOpenCategory] = useState<CategoryId | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const scrollToHash = (hash: string) => {
    const id = hash.replace(/^#/, "");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    return false;
  };

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, link: FooterLinkItem) => {
    if (link.action === "about") {
      e.preventDefault();
      setAboutOpen(true);
      return;
    }
    if (!link.hash) return;
    if (pathname === "/" || pathname === "") {
      e.preventDefault();
      scrollToHash(link.hash);
    }
  };

  const toggleCategory = (id: CategoryId) => {
    setOpenCategory((prev) => (prev === id ? null : id));
  };

  const categories: FooterCategory[] = [
    {
      id: "product",
      title: t.footer.product,
      links: [
        { label: t.footer.links.features, href: "/generate" },
        { label: t.footer.links.stylePacks, href: "/#styles", hash: "#styles" },
        { label: t.footer.links.pricing, href: "/pricing" },
      ],
    },
    {
      id: "company",
      title: t.footer.company,
      links: [
        { label: t.footer.links.about, href: "#about", action: "about" },
        { label: t.footer.links.contact, href: "/support" },
      ],
    },
    {
      id: "legal",
      title: t.footer.legal,
      links: [
        { label: t.footer.links.terms, href: "/terms" },
        { label: t.footer.links.privacy, href: "/privacy" },
      ],
    },
    {
      id: "business",
      title: "사업자정보",
      isBusiness: true,
    },
  ];

  const communityExternal = /^https?:\/\//i.test(SOCIAL_LINKS.community);
  const socialItems: SocialItem[] = [
    { Icon: Twitter, href: SOCIAL_LINKS.twitter, label: "Twitter / X", external: true },
    { Icon: Instagram, href: SOCIAL_LINKS.instagram, label: "Instagram", external: true },
    {
      Icon: Github,
      href: SOCIAL_LINKS.community,
      label: "Community",
      external: communityExternal,
    },
    { Icon: Mail, href: `mailto:${contactEmail}`, label: contactEmail, external: true },
  ];

  const linkClass =
    "block py-1 text-sm text-zinc-400 transition-colors hover:text-white";
  const socialClass =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-zinc-400 transition-all duration-300 hover:border-white/45 hover:text-white";

  const telHref = `tel:${business.phone.replace(/-/g, "")}`;

  const brandBlock = (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
      {/* Logo + name */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="leading-none">
          <span className="font-display text-base font-semibold">Studio Canvas</span>
          <span className="ml-1.5 text-[10px] tracking-[0.2em] text-zinc-400 uppercase">AI</span>
        </div>
      </div>
      {/* Tagline */}
      <p className="text-center text-xs leading-relaxed text-zinc-400 sm:text-left sm:text-sm sm:text-zinc-300">
        {t.footer.tagline1}&nbsp;{t.footer.tagline2}
      </p>
      {/* Social icons */}
      <div className="flex gap-2 sm:ml-auto">
        {socialItems.map(({ Icon, href, label, external }) =>
          external ? (
            <a
              key={label}
              href={href}
              className={socialClass}
              aria-label={label}
              {...(href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            >
              <Icon className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Link key={label} href={href} className={socialClass} aria-label={label}>
              <Icon className="h-3.5 w-3.5" />
            </Link>
          )
        )}
      </div>
    </div>
  );

  const businessInfoBlock = (
    <dl className="grid gap-1.5 text-xs leading-relaxed py-3 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-2">
      <div className="flex gap-2">
        <dt className="w-32 shrink-0 text-zinc-500">상호</dt>
        <dd className="min-w-0 text-zinc-200">{business.companyName}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-32 shrink-0 text-zinc-500">대표자</dt>
        <dd className="min-w-0 text-zinc-200">{business.ceoName}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-32 shrink-0 text-zinc-500">사업자등록번호</dt>
        <dd className="min-w-0 text-zinc-200">{business.businessNumber}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-32 shrink-0 text-zinc-500">통신판매업신고</dt>
        <dd className="min-w-0 text-zinc-200">{business.mailOrderNumber}</dd>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <dt className="w-32 shrink-0 text-zinc-500">사업장 주소</dt>
        <dd className="min-w-0 text-zinc-200">
          <span className="inline-flex items-start gap-1">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
            {business.address}
          </span>
        </dd>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <dt className="w-32 shrink-0 text-zinc-500">고객센터</dt>
        <dd className="min-w-0 text-zinc-200">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={`mailto:${business.email}`}
              className="inline-flex items-center gap-1 text-zinc-200 transition-colors hover:text-white"
            >
              <Mail className="h-3 w-3 text-zinc-500" aria-hidden />
              {business.email}
            </a>
            <a
              href={telHref}
              className="inline-flex items-center gap-1 text-zinc-200 transition-colors hover:text-white"
            >
              <Phone className="h-3 w-3 text-zinc-500" aria-hidden />
              {business.phone}
            </a>
          </span>
        </dd>
      </div>
    </dl>
  );

  return (
    <footer className="border-t border-white/[0.06] bg-navy-light/50 pb-24 md:pb-0">
      {/* Hidden server-rendered slot for PG scanners — kept for SEO / PortOne */}
      <div className="sr-only" aria-hidden>
        {businessSlot}
      </div>

      <div className="mx-auto w-full max-w-full px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 xl:px-12">
        {/* Brand row — always visible */}
        {brandBlock}

        {/* Accordion nav bar */}
        <div className="mt-6 border-t border-white/[0.06]">
          {/* Category button row */}
          <div className="flex flex-wrap items-center gap-0 divide-x divide-white/[0.08]">
            {categories.map((cat) => {
              const open = openCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  aria-expanded={open}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors first:pl-0 ${
                    open ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {cat.id === "business" && (
                    <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                  )}
                  {cat.title}
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180 text-white" : "text-zinc-500"}`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>

          {/* Accordion panels — one visible at a time */}
          {categories.map((cat) => {
            const open = openCategory === cat.id;
            return (
              <AccordionPanel key={cat.id} open={open}>
                {cat.isBusiness ? (
                  <div className="border-t border-white/[0.06]">
                    {businessInfoBlock}
                  </div>
                ) : (
                  <div className="border-t border-white/[0.06] py-3">
                    <ul className="flex flex-wrap gap-x-6 gap-y-1.5">
                      {cat.links?.map((link) => (
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
                )}
              </AccordionPanel>
            );
          })}
        </div>

        {/* Copyright */}
        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <p className="text-center text-[11px] leading-relaxed text-zinc-500 sm:text-left sm:text-xs sm:text-zinc-400">
            {t.footer.copyright}
          </p>
        </div>
      </div>

      <AboutCompanyModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        business={business}
      />
    </footer>
  );
}
