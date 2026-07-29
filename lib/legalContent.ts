export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
};

const COMPANY_BLOCK_KR = [
  "상호: 케이웰니스 허브 라이프 (K-Wellness Hub Life)",
  "대표자: 홍옥연",
  "사업자등록번호: 416-54-00891",
  "사업장 주소: 경상북도 상주시 북상주로 70-6, 가동 302호 (화산동, 동경타운)",
  "고객센터: 010-7778-1146",
  "이메일: scd77777@naver.com",
];

const COMPANY_BLOCK_EN = [
  "Company: K-Wellness Hub Life (케이웰니스 허브 라이프)",
  "CEO: Hong Ok-yeon",
  "Business Registration No.: 416-54-00891",
  "Address: #302, Building A, 70-6 Buksangju-ro, Sangju-si, Gyeongsangbuk-do, Republic of Korea",
  "Support: 010-7778-1146",
  "Email: scd77777@naver.com",
];

export const TERMS_KR: LegalDocument = {
  title: "이용약관",
  updatedAt: "2026-07-29",
  sections: [
    {
      title: "제1조 (목적)",
      paragraphs: [
        "본 약관은 케이웰니스 허브 라이프(이하 “회사”)가 운영하는 Studio Canvas AI 서비스(이하 “서비스”)의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.",
        "서비스는 AI 기반 인물 포트레이트 및 화보 이미지 생성 기능을 제공합니다.",
      ],
    },
    {
      title: "제2조 (회사 정보)",
      bullets: COMPANY_BLOCK_KR,
    },
    {
      title: "제3조 (정의)",
      bullets: [
        "“이용자”란 본 약관에 동의하고 서비스를 이용하는 회원 및 비회원을 말합니다.",
        "“크레딧”이란 화보 생성·재생성 등 유료 기능을 이용하기 위해 필요한 서비스 내 사용 단위를 말합니다.",
        "“구독”이란 월간 정기구독을 통해 크레딧 및 플랜 혜택을 제공받는 이용 형태를 말합니다.",
      ],
    },
    {
      title: "제4조 (구독 및 결제)",
      paragraphs: [
        "이용자는 월간 정기구독 또는 단건(크레딧 팩) 구매를 통해 크레딧을 부여받을 수 있습니다.",
        "정기구독은 매월 이용자가 선택한 결제 수단으로 자동 갱신·결제되며, 결제 완료 시 해당 플랜의 크레딧이 지급됩니다.",
        "결제 금액, 제공 크레딧, 플랜 혜택은 서비스 내 요금제 화면에 고지된 내용을 따릅니다.",
      ],
    },
    {
      title: "제5조 (환불 규정) — 중요",
      paragraphs: [
        "환불은 아래 기준에 따라 엄격히 적용됩니다. 자동 갱신으로 발생한 각 결제 회차에도 동일하게 적용됩니다.",
      ],
      bullets: [
        "결제 완료일로부터 7일 이내에, 제공된 크레딧을 단 1회도 사용하지 않은 경우에 한하여 100% 전액 환불이 가능합니다.",
        "이미 1회 이상 화보를 생성하여 크레딧을 소모하였거나, 결제일로부터 7일이 경과한 경우에는 환불이 절대 불가능합니다.",
        "시스템 오류로 크레딧만 차감되고 이미지가 생성되지 않은 경우, 고객센터 확인 후 해당 크레딧을 복구하거나 결제 취소를 처리할 수 있습니다.",
      ],
    },
    {
      title: "제6조 (AI 생성물 및 저작권)",
      bullets: [
        "이용자가 업로드한 사진의 권리는 이용자에게 있습니다.",
        "서비스가 생성한 결과물의 이용 범위는 이용자가 가입한 요금제 및 관련 안내에 따릅니다.",
        "타인의 사진을 무단으로 도용하거나, 딥페이크·불법·음란물 등 법령에 위반되는 콘텐츠를 생성하는 경우, 회사는 사전 통보 없이 계정을 정지·해지할 수 있으며, 이에 따른 법적 책임은 이용자 본인에게 있습니다.",
      ],
    },
    {
      title: "제7조 (서비스 이용 제한)",
      paragraphs: [
        "회사는 약관 위반, 부정 이용, 시스템 남용, 결제 부정 등이 확인될 경우 서비스 이용을 제한하거나 계정을 정지할 수 있습니다.",
      ],
    },
    {
      title: "제8조 (면책)",
      paragraphs: [
        "회사는 천재지변, 통신 장애, 외부 AI 인프라 장애 등 불가항력으로 인한 서비스 중단에 대해 법령이 허용하는 범위 내에서 책임을 제한할 수 있습니다.",
        "이용자가 업로드한 콘텐츠 및 생성 결과물의 사용으로 인해 발생하는 제3자 분쟁에 대한 책임은 원칙적으로 이용자에게 있습니다.",
      ],
    },
    {
      title: "제9조 (약관 변경)",
      paragraphs: [
        "회사는 필요한 경우 약관을 변경할 수 있으며, 변경 시 서비스 내 공지 또는 이메일 등으로 안내합니다. 변경 이후에도 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다.",
      ],
    },
    {
      title: "제10조 (문의)",
      paragraphs: [
        "약관 및 서비스 관련 문의는 고객센터(010-7778-1146) 또는 이메일(scd77777@naver.com)로 연락해 주세요.",
      ],
    },
  ],
};

export const PRIVACY_KR: LegalDocument = {
  title: "개인정보처리방침",
  updatedAt: "2026-07-29",
  sections: [
    {
      title: "1. 개인정보의 수집 항목",
      paragraphs: ["회사는 서비스 제공을 위해 다음 정보를 수집·처리할 수 있습니다."],
      bullets: [
        "이메일 주소",
        "소셜 로그인 식별자(카카오, 구글, 네이버 등)",
        "결제 기록",
        "업로드된 사진 파일",
        "생성된 화보 이미지 데이터",
      ],
    },
    {
      title: "2. 개인정보의 이용 목적",
      bullets: [
        "회원 가입·로그인 및 회원 관리",
        "AI 화보 이미지 생성 서비스 제공",
        "고객센터(CS) 응대",
        "결제 정산 및 환불·크레딧 복구 처리",
      ],
    },
    {
      title: "3. 보유 및 파기",
      bullets: [
        "원본 사진은 AI 생성 완료 후, 시스템 보관 기간이 경과하면 지체 없이 파기합니다.",
        "회원 탈퇴 시 관련 개인정보는 즉시 파기합니다. 다만, 관련 법령에 따라 보관이 필요한 결제·거래 기록은 법정 기간 동안 보관합니다.",
        "생성 결과물의 보관 기간은 이용 중인 요금제 및 서비스 정책에 따릅니다.",
      ],
    },
    {
      title: "4. 제3자 제공 및 처리 위탁",
      paragraphs: [
        "회사는 서비스 제공에 필요한 범위에서 아래 유형의 인프라·파트너에 최소한의 데이터를 시스템적으로 처리할 수 있습니다.",
      ],
      bullets: [
        "결제대행(PG)사: 결제·정산 처리",
        "AI 서비스 인프라: Replicate, Fal.ai 등 — 이미지 생성 처리",
        "호스팅·CDN: Vercel, Cloudflare — 서비스 운영 및 파일 저장/전송",
      ],
    },
    {
      title: "5. 이용자의 권리",
      paragraphs: [
        "이용자는 개인정보 열람·정정·삭제·처리 정지를 요청할 수 있으며, 회원 탈퇴를 통해 수집·이용 동의를 철회할 수 있습니다. 요청은 고객센터 또는 이메일(scd77777@naver.com)로 접수합니다.",
      ],
    },
    {
      title: "6. 안전성 확보 조치",
      paragraphs: [
        "회사는 개인정보 보호를 위해 접근 통제, 전송 구간 암호화, 권한 최소화 등 합리적 보호조치를 시행합니다.",
      ],
    },
    {
      title: "7. 개인정보 보호 책임 및 문의",
      bullets: COMPANY_BLOCK_KR,
      paragraphs: [
        "개인정보 관련 문의는 위 연락처로 접수해 주시면 신속히 안내드리겠습니다.",
      ],
    },
  ],
};

export const TERMS_EN: LegalDocument = {
  title: "Terms of Service",
  updatedAt: "2026-07-29",
  sections: [
    {
      title: "1. Purpose",
      paragraphs: [
        "These Terms govern the use of Studio Canvas AI (the “Service”) operated by K-Wellness Hub Life (the “Company”), including AI-based portrait and lookbook image generation.",
      ],
    },
    {
      title: "2. Company Information",
      bullets: COMPANY_BLOCK_EN,
    },
    {
      title: "3. Subscriptions & Payments",
      paragraphs: [
        "Users obtain credits via monthly subscription or one-time credit pack purchases.",
        "Subscriptions renew and charge automatically each month using the selected payment method.",
      ],
    },
    {
      title: "4. Refund Policy (Important)",
      bullets: [
        "A full 100% refund is available only within 7 days of payment AND only if none of the granted credits have been used.",
        "If any portrait has been generated (credits consumed) OR more than 7 days have passed since payment, refunds are not available. The same rule applies to each automatic renewal charge.",
        "If credits are deducted due to a system error without a generated image, we may restore credits or cancel the charge after support verification.",
      ],
    },
    {
      title: "5. AI Outputs & Copyright",
      bullets: [
        "Rights to photos uploaded by the user remain with the user.",
        "Unauthorized use of others’ photos, deepfakes, or illegal/obscene content may result in immediate account suspension without prior notice. Legal liability rests with the user.",
      ],
    },
    {
      title: "6. Contact",
      paragraphs: [
        "Questions: 010-7778-1146 or scd77777@naver.com.",
      ],
    },
  ],
};

export const PRIVACY_EN: LegalDocument = {
  title: "Privacy Policy",
  updatedAt: "2026-07-29",
  sections: [
    {
      title: "1. Data We Collect",
      bullets: [
        "Email address",
        "Social login identifiers",
        "Payment records",
        "Uploaded photo files",
        "Generated lookbook image data",
      ],
    },
    {
      title: "2. Purpose of Use",
      bullets: [
        "Account management",
        "Providing AI portrait generation",
        "Customer support",
        "Payment settlement",
      ],
    },
    {
      title: "3. Retention & Deletion",
      bullets: [
        "Original photos are deleted without undue delay after the system retention period following generation.",
        "Upon account deletion, personal data is deleted promptly, except payment records retained for legally required periods.",
      ],
    },
    {
      title: "4. Processors / Infrastructure",
      paragraphs: [
        "Minimum necessary data may be processed by payment providers (PG) and infrastructure partners such as Replicate, Fal.ai, Vercel, and Cloudflare to operate the Service.",
      ],
    },
    {
      title: "5. Contact",
      bullets: COMPANY_BLOCK_EN,
    },
  ],
};

export function getTermsDocument(locale: string): LegalDocument {
  return locale === "kr" ? TERMS_KR : TERMS_EN;
}

export function getPrivacyDocument(locale: string): LegalDocument {
  return locale === "kr" ? PRIVACY_KR : PRIVACY_EN;
}
