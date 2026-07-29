/**
 * Merchant / business disclosure for KR ecommerce footer (#PG compliance).
 * Override via env; placeholders shown until configured.
 */
export type BusinessInfo = {
  companyName: string;
  ceoName: string;
  businessNumber: string;
  mailOrderNumber: string;
  address: string;
  email: string;
  phone: string;
  hostingProvider: string;
};

export function getBusinessInfo(): BusinessInfo {
  return {
    companyName: process.env.BUSINESS_COMPANY_NAME || "Studio Canvas AI",
    ceoName: process.env.BUSINESS_CEO_NAME || "(대표자명 설정 필요)",
    businessNumber: process.env.BUSINESS_REG_NO || "(사업자등록번호 설정 필요)",
    mailOrderNumber: process.env.BUSINESS_MAIL_ORDER_NO || "(통신판매업신고 설정 필요)",
    address: process.env.BUSINESS_ADDRESS || "(사업장 주소 설정 필요)",
    email: process.env.BUSINESS_EMAIL || "support@studiocanvas.ai",
    phone: process.env.BUSINESS_PHONE || "(고객센터 연락처 설정 필요)",
    hostingProvider: process.env.BUSINESS_HOSTING || "Vercel / Cloudflare R2",
  };
}

export function isBusinessInfoComplete() {
  return Boolean(
    process.env.BUSINESS_COMPANY_NAME &&
      process.env.BUSINESS_CEO_NAME &&
      process.env.BUSINESS_REG_NO &&
      process.env.BUSINESS_MAIL_ORDER_NO &&
      process.env.BUSINESS_ADDRESS
  );
}
