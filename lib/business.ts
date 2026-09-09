/**
 * Merchant / business disclosure for KR ecommerce footer.
 * Defaults are the live entity; override any field via env.
 */
export type BusinessInfo = {
  companyName: string;
  ceoName: string;
  businessNumber: string;
  /** 통신판매신고번호 — override via BUSINESS_MAIL_ORDER_NO if needed */
  mailOrderNumber: string;
  address: string;
  email: string;
  phone: string;
  hostingProvider: string;
};

/** Official mail-order (통신판매) registration number */
export const MAIL_ORDER_NUMBER = "2026-경북상주-0109호";

/** @deprecated Use MAIL_ORDER_NUMBER — kept for older imports */
export const MAIL_ORDER_NUMBER_PENDING = MAIL_ORDER_NUMBER;

/** Canonical business profile (Studio Canvas AI operator) */
export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  companyName: "케이웰니스 허브 라이프 (K-Wellness Hub Life)",
  ceoName: "홍옥연",
  businessNumber: "416-54-00891",
  mailOrderNumber: MAIL_ORDER_NUMBER,
  address: "경상북도 상주시 북상주로 70-6, 가동 302호 (화산동, 동경타운)",
  email: "studiocanvas.cs@gmail.com",
  phone: "070-4207-1876",
  hostingProvider: "Vercel / Cloudflare R2",
};

export function getBusinessInfo(): BusinessInfo {
  const mailOrderRaw = process.env.BUSINESS_MAIL_ORDER_NO;
  const mailOrderNumber =
    mailOrderRaw !== undefined && mailOrderRaw.trim() !== ""
      ? mailOrderRaw.trim()
      : DEFAULT_BUSINESS_INFO.mailOrderNumber;

  return {
    companyName: process.env.BUSINESS_COMPANY_NAME || DEFAULT_BUSINESS_INFO.companyName,
    ceoName: process.env.BUSINESS_CEO_NAME || DEFAULT_BUSINESS_INFO.ceoName,
    businessNumber: process.env.BUSINESS_REG_NO || DEFAULT_BUSINESS_INFO.businessNumber,
    mailOrderNumber,
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
