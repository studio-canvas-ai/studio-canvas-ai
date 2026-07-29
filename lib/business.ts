/**
 * Merchant / business disclosure for KR ecommerce footer.
 * Defaults are the live entity; override any field via env.
 */
export type BusinessInfo = {
  companyName: string;
  ceoName: string;
  businessNumber: string;
  /** Optional — omit from UI when empty */
  mailOrderNumber: string;
  address: string;
  email: string;
  phone: string;
  hostingProvider: string;
};

/** Canonical business profile (Studio Canvas AI operator) */
export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  companyName: "케이웰니스 허브 라이프 (K-Wellness Hub Life)",
  ceoName: "홍옥연",
  businessNumber: "416-54-00891",
  mailOrderNumber: "",
  address: "경상북도 상주시 북상주로 70-6, 가동 302호 (화산동, 동경타운)",
  email: "scd77777@naver.com",
  phone: "010-7778-1146",
  hostingProvider: "Vercel / Cloudflare R2",
};

export function getBusinessInfo(): BusinessInfo {
  return {
    companyName: process.env.BUSINESS_COMPANY_NAME || DEFAULT_BUSINESS_INFO.companyName,
    ceoName: process.env.BUSINESS_CEO_NAME || DEFAULT_BUSINESS_INFO.ceoName,
    businessNumber: process.env.BUSINESS_REG_NO || DEFAULT_BUSINESS_INFO.businessNumber,
    mailOrderNumber:
      process.env.BUSINESS_MAIL_ORDER_NO ?? DEFAULT_BUSINESS_INFO.mailOrderNumber,
    address: process.env.BUSINESS_ADDRESS || DEFAULT_BUSINESS_INFO.address,
    email: process.env.BUSINESS_EMAIL || DEFAULT_BUSINESS_INFO.email,
    phone: process.env.BUSINESS_PHONE || DEFAULT_BUSINESS_INFO.phone,
    hostingProvider: process.env.BUSINESS_HOSTING || DEFAULT_BUSINESS_INFO.hostingProvider,
  };
}

export function isBusinessInfoComplete() {
  const info = getBusinessInfo();
  return Boolean(
    info.companyName && info.ceoName && info.businessNumber && info.address && info.email
  );
}
