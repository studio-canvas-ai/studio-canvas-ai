import BusinessDisclosure from "@/components/BusinessDisclosure";
import FooterClient from "@/components/FooterClient";
import { getBusinessInfo } from "@/lib/business";

/**
 * Server entry for the site footer. Business disclosure is rendered on the
 * server so PortOne (and similar) scanners can read merchant fields from the
 * raw HTML without executing JavaScript.
 */
export default function Footer() {
  const biz = getBusinessInfo();

  return (
    <FooterClient
      contactEmail={biz.email}
      business={biz}
      businessSlot={<BusinessDisclosure />}
    />
  );
}
