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
    <div className="flex gap-2 leading-relaxed">
      <dt className="w-[5.5rem] shrink-0 text-zinc-500 sm:w-28">{label}</dt>
      <dd className="min-w-0 text-zinc-200">{children}</dd>
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
      className="mt-8 md:mt-12"
      aria-label="사업자 정보"
    >
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          <h3 className="text-xs font-semibold tracking-wide text-zinc-300">
            {t.footer.businessHeading}
          </h3>
        </div>

        <dl className="grid gap-1.5 text-xs leading-relaxed sm:grid-cols-2 sm:gap-x-8 sm:gap-y-2">
          <BizRow label="상호">
            <span itemProp="name">{biz.companyName}</span>
          </BizRow>
          <BizRow label={t.footer.ceo}>
            <span itemProp="founder">{biz.ceoName}</span>
          </BizRow>
          <BizRow label={t.footer.businessNumber}>
            <span itemProp="taxID">{biz.businessNumber}</span>
          </BizRow>
          <BizRow label={t.footer.mailOrder}>{biz.mailOrderNumber}</BizRow>
          <BizRow label={t.footer.address}>
            <span className="inline-flex items-start gap-1" itemProp="address">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
              <span>{biz.address}</span>
            </span>
          </BizRow>
          <BizRow label={t.footer.contact}>
            <span className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-3">
              <a
                href={`mailto:${biz.email}`}
                itemProp="email"
                className="inline-flex items-center gap-1 text-zinc-200 transition-colors hover:text-white"
              >
                <Mail className="h-3 w-3 text-zinc-500" aria-hidden />
                {biz.email}
              </a>
              <a
                href={telHref}
                itemProp="telephone"
                className="inline-flex items-center gap-1 text-zinc-200 transition-colors hover:text-white"
              >
                <Phone className="h-3 w-3 text-zinc-500" aria-hidden />
                {biz.phone}
              </a>
            </span>
          </BizRow>
          {biz.hostingProvider ? (
            <BizRow label={t.footer.hosting}>{biz.hostingProvider}</BizRow>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
