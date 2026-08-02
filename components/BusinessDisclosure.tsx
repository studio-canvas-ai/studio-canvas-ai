import type { ReactNode } from "react";
import { Building2, Mail, MapPin, Phone } from "lucide-react";
import { getBusinessInfo } from "@/lib/business";
import { getTranslations } from "@/lib/i18n";

/**
 * Server-rendered merchant disclosure for PortOne / KR ecommerce scanners.
 * Values come from env via getBusinessInfo() and are present in the HTML source
 * without waiting for client JS or /api/business.
 */
function BizRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-[11px] font-medium tracking-wide text-zinc-300 sm:w-28">
        {label}
      </dt>
      <dd className="min-w-0 text-[12px] leading-relaxed text-zinc-100 sm:text-[13px]">
        {children}
      </dd>
    </div>
  );
}

export default function BusinessDisclosure() {
  const biz = getBusinessInfo();
  // Korean labels are intentional: PG auto-scanners expect KR field names in source HTML.
  const t = getTranslations("kr");
  const telHref = `tel:${biz.phone.replace(/-/g, "")}`;

  return (
    <section
      id="business-info"
      itemScope
      itemType="https://schema.org/Organization"
      className="mt-12 border-t border-white/[0.06] pt-8"
      aria-label="사업자 정보"
    >
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-zinc-300" aria-hidden />
        <h3 className="text-sm font-medium text-zinc-200">{t.footer.businessHeading}</h3>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:gap-x-10 lg:gap-y-3">
        <BizRow label="상호">
          <span itemProp="name">{biz.companyName}</span>
        </BizRow>
        <BizRow label={t.footer.ceo}>
          <span itemProp="founder">{biz.ceoName}</span>
        </BizRow>
        <BizRow label={t.footer.businessNumber}>
          <span itemProp="taxID">{biz.businessNumber}</span>
        </BizRow>
        {biz.mailOrderNumber ? (
          <BizRow label={t.footer.mailOrder}>{biz.mailOrderNumber}</BizRow>
        ) : null}
        <BizRow label={t.footer.address}>
          <span className="inline-flex items-start gap-1.5" itemProp="address">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300" aria-hidden />
            <span>{biz.address}</span>
          </span>
        </BizRow>
        <BizRow label={t.footer.contact}>
          <span className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            <a
              href={`mailto:${biz.email}`}
              itemProp="email"
              className="inline-flex items-center gap-1.5 text-zinc-100 transition-colors hover:text-white"
            >
              <Mail className="h-3.5 w-3.5 text-zinc-300" aria-hidden />
              {biz.email}
            </a>
            <a
              href={telHref}
              itemProp="telephone"
              className="inline-flex items-center gap-1.5 text-zinc-100 transition-colors hover:text-white"
            >
              <Phone className="h-3.5 w-3.5 text-zinc-300" aria-hidden />
              {biz.phone}
            </a>
          </span>
        </BizRow>
        {biz.hostingProvider ? (
          <BizRow label={t.footer.hosting}>{biz.hostingProvider}</BizRow>
        ) : null}
      </dl>
    </section>
  );
}
