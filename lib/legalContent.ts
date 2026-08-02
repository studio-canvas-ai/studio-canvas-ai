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

const UPDATED_AT = "2026-07-31";

export const TERMS_KR: LegalDocument = {
  title: "이용약관",
  updatedAt: UPDATED_AT,
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
        "“월간 요금제(Monthly Subscription)”란 매월 지정된 결제일에 등록된 결제 수단으로 자동 청구되는 정기구독을 말합니다.",
        "“3개월 이용권(3-Month Pass)”이란 3개월(90일) 단위로 금액을 한 번에 선불(일시불) 결제하는 1회성·단건 이용권을 말하며, 기간 종료 후 자동 결제나 자동 연장이 절대 발생하지 않습니다.",
      ],
    },
    {
      title: "제4조 (결제 및 서비스 이용 방식)",
      paragraphs: [
        "이용자는 월간 요금제 또는 3개월 이용권 구매를 통해 크레딧 및 플랜 혜택을 부여받을 수 있습니다. 결제 금액, 제공 크레딧, 플랜 혜택은 서비스 내 요금제 화면에 고지된 내용을 따릅니다.",
      ],
      bullets: [
        "월간 요금제: 매월 지정된 날짜에 등록된 카드(또는 선택한 결제 수단)로 자동 청구되는 정기 결제입니다. 이용자는 마이페이지에서 언제든지 다음 결제 주기의 해지를 신청할 수 있으며, 해지 예약 시 현재 결제 주기 종료일까지 서비스를 이용할 수 있습니다.",
        "3개월 이용권: 3개월(90일)치 금액을 1회만 선불·일시불로 결제하는 일반결제(One-time Checkout)입니다. 기간이 끝나도 카드가 자동으로 청구되거나 이용권이 자동 연장되지 않으며, 이용 기간이 종료되면 이용권이 자동 만료됩니다.",
        "업그레이드: 이용 기간 중 상위 플랜으로 변경하는 경우, 기존 남은 기간의 가치를 일할 계산하여 차액만 결제하며, 기존 잔여 크레딧은 이월됩니다. 업그레이드가 완료된 날부터 새로운 3개월(90일) 이용 기간이 시작됩니다(3개월 이용권 기준).",
      ],
    },
    {
      title: "제5조 (3개월 이용권 만료 및 재구매 안내)",
      bullets: [
        "3개월 이용권은 결제일로부터 90일이 경과하면 자동 만료됩니다.",
        "만료 시점에 등록된 카드로 자동 결제가 진행되지 않으며, 자동 연장도 발생하지 않습니다.",
        "회사는 만료 시점에 서비스 내 알림 및/또는 이메일(또는 등록된 연락 수단)을 통해 이용권 만료 사실과 재구매 안내를 제공할 수 있습니다. 재구매는 이용자의 별도 의사표시와 결제 완료가 있어야 성립합니다.",
      ],
    },
    {
      title: "제6조 (환불 및 청약철회) — 중요",
      paragraphs: [
        "환불 및 청약철회는 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관련 법령과 아래 기준에 따라 적용됩니다. 월간 요금제의 자동 갱신으로 발생한 각 결제 회차, 3개월·연간 이용권 및 크레딧 단품 결제에도 동일하게 적용됩니다.",
        "조건을 충족하는 경우 서비스는 결제 PG(국내: Toss/NHN KCP 등, 해외: Stripe)를 통해 담당자 개입 없이 자동 환불을 처리할 수 있습니다.",
      ],
      bullets: [
        "[자동 청약철회] 결제 완료일로부터 7일 이내이고, 해당 결제로 지급된 크레딧을 단 1회도 사용하지 않은 경우: 전액 자동 환불이 승인·처리됩니다.",
        "[환불 제한] 이미 1회 이상 화보 생성·재생성 등으로 크레딧을 소모하였거나, 결제일로부터 7일이 경과한 경우: 디지털 콘텐츠 제공이 개시된 경우에 해당하여 법령이 허용하는 범위 내에서 청약철회가 제한되며, 원칙적으로 자동 환불이 불가(거절·반려)합니다.",
        "[시스템 오류 예외] 시스템 장애로 크레딧만 차감되고 결과물이 생성되지 않은 경우 등에는 기간·사용 여부와 관계없이 관리자 확인 후 크레딧 복구 또는 예외 환불을 처리할 수 있습니다.",
        "환불 완료 시 결제 상태는 환불 완료로 변경되고, 해당 결제로 부여된 크레딧·이용 권한은 회수·동기화됩니다.",
        "자동 환불이 거절된 경우 또는 예외 심사가 필요한 경우 고객센터(010-7778-1146) 또는 이메일(scd77777@naver.com)로 접수해 주세요.",
      ],
    },
    {
      title: "제7조 (AI 생성물 및 저작권)",
      bullets: [
        "이용자가 업로드한 사진의 권리는 이용자에게 있습니다.",
        "서비스가 생성한 결과물의 이용 범위는 이용자가 가입한 요금제 및 관련 안내에 따릅니다.",
        "타인의 사진을 무단으로 도용하거나, 딥페이크·불법·음란물 등 법령에 위반되는 콘텐츠를 생성하는 경우, 회사는 사전 통보 없이 계정을 정지·해지할 수 있으며, 이에 따른 법적 책임은 이용자 본인에게 있습니다.",
      ],
    },
    {
      title: "제8조 (서비스 이용 제한)",
      paragraphs: [
        "회사는 약관 위반, 부정 이용, 시스템 남용, 결제 부정 등이 확인될 경우 서비스 이용을 제한하거나 계정을 정지할 수 있습니다.",
      ],
    },
    {
      title: "제9조 (면책)",
      paragraphs: [
        "회사는 천재지변, 통신 장애, 외부 AI 인프라 장애 등 불가항력으로 인한 서비스 중단에 대해 법령이 허용하는 범위 내에서 책임을 제한할 수 있습니다.",
        "이용자가 업로드한 콘텐츠 및 생성 결과물의 사용으로 인해 발생하는 제3자 분쟁에 대한 책임은 원칙적으로 이용자에게 있습니다.",
      ],
    },
    {
      title: "제10조 (약관 변경)",
      paragraphs: [
        "회사는 필요한 경우 약관을 변경할 수 있으며, 변경 시 서비스 내 공지 또는 이메일 등으로 안내합니다. 변경 이후에도 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다.",
      ],
    },
    {
      title: "제11조 (문의)",
      paragraphs: [
        "약관 및 서비스 관련 문의는 고객센터(010-7778-1146) 또는 이메일(scd77777@naver.com)로 연락해 주세요.",
      ],
    },
  ],
};

export const PRIVACY_KR: LegalDocument = {
  title: "개인정보처리방침",
  updatedAt: UPDATED_AT,
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

function buildInternationalTerms(input: {
  title: string;
  purposeTitle: string;
  purpose: string;
  companyTitle: string;
  definitionsTitle: string;
  definitions: string[];
  paymentTitle: string;
  paymentIntro: string;
  monthly: string;
  annual: string;
  packs: string;
  expiryTitle: string;
  expiryBullets: string[];
  refundTitle: string;
  refundIntro: string;
  refundBullets: string[];
  aiTitle: string;
  aiBullets: string[];
  restrictTitle: string;
  restrict: string;
  contactTitle: string;
  contact: string;
}): LegalDocument {
  return {
    title: input.title,
    updatedAt: UPDATED_AT,
    sections: [
      {
        title: input.purposeTitle,
        paragraphs: [input.purpose],
      },
      {
        title: input.companyTitle,
        bullets: COMPANY_BLOCK_EN,
      },
      {
        title: input.definitionsTitle,
        bullets: input.definitions,
      },
      {
        title: input.paymentTitle,
        paragraphs: [input.paymentIntro],
        bullets: [input.monthly, input.annual, input.packs],
      },
      {
        title: input.expiryTitle,
        bullets: input.expiryBullets,
      },
      {
        title: input.refundTitle,
        paragraphs: [input.refundIntro],
        bullets: input.refundBullets,
      },
      {
        title: input.aiTitle,
        bullets: input.aiBullets,
      },
      {
        title: input.restrictTitle,
        paragraphs: [input.restrict],
      },
      {
        title: input.contactTitle,
        paragraphs: [input.contact],
      },
    ],
  };
}

export const TERMS_EN: LegalDocument = buildInternationalTerms({
  title: "Terms of Service",
  purposeTitle: "1. Purpose",
  purpose:
    "These Terms govern the use of Studio Canvas AI (the “Service”) operated by K-Wellness Hub Life (the “Company”), including AI-based portrait and lookbook image generation.",
  companyTitle: "2. Company Information",
  definitionsTitle: "3. Definitions",
  definitions: [
    "“Credits” are the in-service units required to use paid features such as portrait generation and regeneration.",
    "“Monthly Subscription” is a recurring plan billed automatically on a scheduled date each month to the registered payment method.",
    "“Annual Pass” is a prepaid, one-time purchase covering 365 days of access. It does not auto-renew after the access period ends.",
  ],
  paymentTitle: "4. Payments & Service Plans",
  paymentIntro:
    "Users may obtain credits and plan benefits through a Monthly Subscription, an Annual Pass, or one-time credit packs. Prices, credits, and benefits are as shown on the pricing page.",
  monthly:
    "Monthly Subscription: Charged automatically each month on the designated billing date. You may request cancellation of the next billing cycle at any time from My Page; access continues until the end of the current paid period.",
  annual:
    "Annual Pass: A one-time prepaid checkout for 12 months (365 days). Your card is not automatically charged again after one year, and the pass expires automatically when the access period ends.",
  packs: "Credit packs may be purchased separately from subscriptions/passes when needed.",
  expiryTitle: "5. Annual Pass Expiry & Repurchase Notice",
  expiryBullets: [
    "An Annual Pass expires automatically 365 days after purchase.",
    "No automatic card charge occurs at expiry.",
    "At expiry, the Company may send an in-service and/or email notice about access expiration and standard-price repurchase information. Repurchase requires your separate confirmation and payment.",
  ],
  refundTitle: "6. Refunds & Withdrawal (Important)",
  refundIntro:
    "Refunds and withdrawals follow applicable consumer e-commerce rules and the criteria below. The same rules apply to each Monthly Subscription renewal, each 3-month/Annual Pass, and each credit-pack payment. When criteria are met, the service may process an automatic refund via the payment provider (domestic: Toss/NHN KCP rails; global: Stripe) without manual staff intervention.",
  refundBullets: [
    "[Automatic withdrawal] Within 7 days of payment, if none of the credits granted by that payment have been used: a full automatic refund is approved and processed.",
    "[Refund limits] If any credits have been used for generation/regeneration, or more than 7 days have passed since payment: withdrawal is limited once digital content supply has begun, and automatic refunds are generally denied.",
    "[System-error exception] If credits are deducted due to a system failure without a generated result, support/admin may restore credits or approve an exception refund regardless of the 7-day window or usage.",
    "When a refund completes, the payment status is updated and credits/entitlements from that payment are clawed back in sync.",
    "If automatic refund is denied or an exception review is needed: 010-7778-1146 or scd77777@naver.com.",
  ],
  aiTitle: "7. AI Outputs & Copyright",
  aiBullets: [
    "Rights to photos uploaded by the user remain with the user.",
    "Unauthorized use of others’ photos, deepfakes, or illegal/obscene content may result in immediate account suspension without prior notice. Legal liability rests with the user.",
  ],
  restrictTitle: "8. Service Restrictions",
  restrict:
    "The Company may restrict use or suspend accounts if terms violations, abuse, or fraudulent payments are confirmed.",
  contactTitle: "9. Contact",
  contact: "Questions: 010-7778-1146 or scd77777@naver.com.",
});

export const TERMS_JA: LegalDocument = buildInternationalTerms({
  title: "利用規約",
  purposeTitle: "1. 目的",
  purpose:
    "本規約は、K-Wellness Hub Life（以下「当社」）が運営する Studio Canvas AI（以下「本サービス」）の利用条件、ならびに当社と利用者の権利・義務を定めます。本サービスは AI によるポートレート／ルックブック画像生成機能を提供します。",
  companyTitle: "2. 事業者情報",
  definitionsTitle: "3. 定義",
  definitions: [
    "「クレジット」とは、画像生成・再生成などの有料機能を利用するためのサービス内単位です。",
    "「月額プラン（Monthly Subscription）」とは、毎月所定の日に登録済みの支払い方法へ自動請求される定期課金です。",
    "「年間利用券（Annual Pass）」とは、365日分を一括前払いする1回限りの購入であり、期間終了後に自動更新されません。",
  ],
  paymentTitle: "4. 決済およびサービス利用方式",
  paymentIntro:
    "利用者は月額プラン、年間利用券、または単発のクレジットパックによりクレジットとプラン特典を取得できます。金額・クレジット・特典は料金ページの表示に従います。",
  monthly:
    "月額プラン：毎月指定日にカード等へ自動請求されます。マイページからいつでも次回更新の解約を申請でき、解約予約後も当該課金期間の終了日まで利用できます。",
  annual:
    "年間利用券：12か月（365日）分を一度だけ前払いするワンタイム決済です。1年後にカードが自動更新・追加請求されることはなく、利用期間終了で自動的に失効します。",
  packs: "必要に応じて、サブスクリプション／利用券とは別にクレジットパックを購入できます。",
  expiryTitle: "5. 年間利用券の満了と再購入案内",
  expiryBullets: [
    "年間利用券は購入日から365日経過後に自動失効します。",
    "満了時点で登録カードへの自動課金は行われません。",
    "満了時、当社はサービス内通知および／またはメール等で利用終了と定価での再購入案内を送付する場合があります。再購入は利用者の別途の意思表示と決済完了により成立します。",
  ],
  refundTitle: "6. 返金・クーリングオフ（重要）",
  refundIntro:
    "返金は関連する消費者保護・電子商取引の考え方および以下の基準に従います。月額の各自動更新課金、3か月・年間利用券・クレジットパックの各決済にも同じ基準を適用します。条件を満たす場合、決済事業者（国内: Toss/NHN KCP 等、海外: Stripe）経由で担当者介入なしの自動返金が行われることがあります。",
  refundBullets: [
    "【自動撤回】決済完了日から7日以内で、当該決済により付与されたクレジットを一度も使用していない場合：全額の自動返金が承認・処理されます。",
    "【返金制限】生成・再生成等でクレジットを1回以上使用した場合、または決済から7日を経過した場合：デジタルコンテンツ提供開始後は撤回が制限され、原則として自動返金は拒否されます。",
    "【システム障害の例外】障害により画像が生成されずクレジットのみ減った場合等は、期間・使用の有無にかかわらず管理者確認後にクレジット復元または例外返金が可能です。",
    "返金完了時、決済状態は返金済みに更新され、当該決済のクレジット・権限は回収・同期されます。",
    "自動返金が拒否された場合や例外審査が必要な場合：010-7778-1146 または scd77777@naver.com。",
  ],
  aiTitle: "7. AI生成物と著作権",
  aiBullets: [
    "利用者がアップロードした写真の権利は利用者に帰属します。",
    "他人の写真の無断利用、ディープフェイク、違法・わいせつコンテンツの生成は、事前通知なくアカウント停止の対象となり、法的責任は利用者本人にあります。",
  ],
  restrictTitle: "8. 利用制限",
  restrict:
    "規約違反、不正利用、不正決済等が確認された場合、当社は利用制限またはアカウント停止を行うことがあります。",
  contactTitle: "9. お問い合わせ",
  contact: "お問い合わせ：010-7778-1146 または scd77777@naver.com。",
});

export const TERMS_ZH: LegalDocument = buildInternationalTerms({
  title: "服务条款",
  purposeTitle: "1. 目的",
  purpose:
    "本条款规范由 K-Wellness Hub Life（“公司”）运营的 Studio Canvas AI（“服务”）的使用条件，包括基于 AI 的肖像与画报图像生成。",
  companyTitle: "2. 公司信息",
  definitionsTitle: "3. 定义",
  definitions: [
    "“积分”是指使用生成、再生成等付费功能所需的服务内计量单位。",
    "“月度订阅（Monthly Subscription）”是指在每月指定日期向已登记支付方式自动扣款的定期订阅。",
    "“年度通行证（Annual Pass）”是指一次性预付 365 天使用权的单次购买，到期后不会自动续费。",
  ],
  paymentTitle: "4. 支付与服务使用方式",
  paymentIntro:
    "用户可通过月度订阅、年度通行证或单次积分包获得积分与套餐权益。价格、积分与权益以定价页公示为准。",
  monthly:
    "月度订阅：每月在指定日期自动向登记的银行卡或其他支付方式扣款。用户可随时在“我的页面”申请取消下一计费周期；取消预约后，当前已付周期结束前仍可使用服务。",
  annual:
    "年度通行证：一次性预付 12 个月（365 天）费用。一年后不会自动续费或再次扣款，使用期满后自动失效。",
  packs: "必要时可另行购买与订阅/通行证无关的积分包。",
  expiryTitle: "5. 年度通行证到期与重新购买说明",
  expiryBullets: [
    "年度通行证自购买之日起满 365 天后自动到期。",
    "到期时不会对登记卡片进行自动扣款。",
    "到期时，公司可通过站内通知和/或电子邮件发送使用期结束提醒及按原价重新购买的说明。重新购买需用户另行确认并完成支付。",
  ],
  refundTitle: "6. 退款与撤回（重要）",
  refundIntro:
    "退款依照相关电子商务消费者保护规则及下列标准执行。月度订阅每次自动续费、3个月/年度通行证与积分包的每次支付均适用相同标准。符合条件时，可通过支付通道（国内：Toss/NHN KCP 等；海外：Stripe）自动退款，无需人工介入。",
  refundBullets: [
    "【自动撤回】支付完成后 7 日内，且该次支付所发放的积分完全未使用：全额自动退款获批并处理。",
    "【退款限制】若已因生成/再生成等使用过积分，或支付已超过 7 日：在数字内容已开始提供的情形下撤回受限，原则上自动退款将被拒绝。",
    "【系统故障例外】因系统故障仅扣积分但未生成结果时，经管理员核实后可不受期限/使用限制恢复积分或例外退款。",
    "退款完成后，支付状态更新为已退款，并同步收回该次支付赋予的积分与权益。",
    "自动退款被拒或需例外审核时：010-7778-1146 或 scd77777@naver.com。",
  ],
  aiTitle: "7. AI 成果与版权",
  aiBullets: [
    "用户上传照片的权利归用户所有。",
    "未经授权使用他人照片、深度伪造或违法/淫秽内容可能导致账户被立即停用，法律责任由用户本人承担。",
  ],
  restrictTitle: "8. 使用限制",
  restrict: "如确认存在违约、滥用或欺诈支付，公司可限制使用或停用账户。",
  contactTitle: "9. 联系方式",
  contact: "咨询：010-7778-1146 或 scd77777@naver.com。",
});

export const TERMS_ES: LegalDocument = buildInternationalTerms({
  title: "Términos de servicio",
  purposeTitle: "1. Objeto",
  purpose:
    "Estos Términos regulan el uso de Studio Canvas AI (el “Servicio”) operado por K-Wellness Hub Life (la “Empresa”), incluida la generación de retratos y lookbooks con IA.",
  companyTitle: "2. Información de la empresa",
  definitionsTitle: "3. Definiciones",
  definitions: [
    "“Créditos” son las unidades del servicio necesarias para funciones de pago como generación y regeneración.",
    "“Suscripción mensual” es un plan recurrente cobrado automáticamente en la fecha designada cada mes al método de pago registrado.",
    "“Pase anual” es una compra prepaga única que cubre 365 días de acceso y no se renueva automáticamente al finalizar.",
  ],
  paymentTitle: "4. Pagos y modalidades del servicio",
  paymentIntro:
    "Los usuarios pueden obtener créditos y beneficios mediante suscripción mensual, pase anual o packs de créditos. Precios y beneficios se muestran en la página de precios.",
  monthly:
    "Suscripción mensual: se cobra automáticamente cada mes en la fecha designada. Puede solicitar la cancelación del siguiente ciclo en Mi página en cualquier momento; el acceso continúa hasta el final del periodo ya pagado.",
  annual:
    "Pase anual: pago único anticipado por 12 meses (365 días). La tarjeta no se cobra de nuevo automáticamente al cabo de un año y el pase caduca al terminar el periodo de acceso.",
  packs: "Los packs de créditos pueden comprarse por separado cuando sea necesario.",
  expiryTitle: "5. Caducidad del pase anual y recompra",
  expiryBullets: [
    "El pase anual caduca automáticamente 365 días después de la compra.",
    "En la caducidad no se realiza ningún cobro automático a la tarjeta.",
    "En la caducidad, la Empresa puede enviar un aviso en el servicio y/o por correo sobre el fin del acceso y la recompra al precio normal. La recompra requiere su confirmación y pago aparte.",
  ],
  refundTitle: "6. Reembolsos y desistimiento (importante)",
  refundIntro:
    "Los reembolsos se rigen por las normas aplicables de comercio electrónico y los criterios siguientes. Igual para cada renovación mensual, cada pase de 3 meses/anual y cada pack. Si se cumplen los requisitos, el servicio puede reembolsar automáticamente vía el proveedor (nacional: Toss/NHN KCP; global: Stripe).",
  refundBullets: [
    "[Desistimiento automático] Dentro de 7 días desde el pago, si no se ha usado ningún crédito de ese pago: reembolso íntegro automático aprobado y procesado.",
    "[Límites] Si se han usado créditos o han pasado más de 7 días: el desistimiento se limita cuando el contenido digital ya se ha suministrado; el reembolso automático se deniega en general.",
    "[Excepción por error del sistema] Si solo se descontaron créditos por fallo sin resultado, soporte/admin puede restaurar créditos o aprobar un reembolso excepcional sin importar plazo o uso.",
    "Al completar el reembolso, el estado del pago se actualiza y se recuperan créditos/derechos de ese pago.",
    "Si el automático se deniega o hace falta revisión: 010-7778-1146 o scd77777@naver.com.",
  ],
  aiTitle: "7. Resultados de IA y derechos",
  aiBullets: [
    "Los derechos sobre las fotos subidas pertenecen al usuario.",
    "El uso no autorizado de fotos ajenas, deepfakes o contenido ilegal/obsceno puede provocar la suspensión inmediata de la cuenta. La responsabilidad legal es del usuario.",
  ],
  restrictTitle: "8. Restricciones",
  restrict:
    "La Empresa puede restringir el uso o suspender cuentas ante incumplimientos, abusos o pagos fraudulentos.",
  contactTitle: "9. Contacto",
  contact: "Consultas: 010-7778-1146 o scd77777@naver.com.",
});

export const TERMS_FR: LegalDocument = buildInternationalTerms({
  title: "Conditions d’utilisation",
  purposeTitle: "1. Objet",
  purpose:
    "Les présentes Conditions régissent l’utilisation de Studio Canvas AI (le « Service ») exploité par K-Wellness Hub Life (la « Société »), y compris la génération de portraits et lookbooks par IA.",
  companyTitle: "2. Informations sur la société",
  definitionsTitle: "3. Définitions",
  definitions: [
    "Les « crédits » sont les unités nécessaires aux fonctions payantes (génération, régénération, etc.).",
    "L’« abonnement mensuel » est un forfait récurrent facturé automatiquement à la date prévue chaque mois sur le moyen de paiement enregistré.",
    "Le « pass annuel » est un achat prépayé unique couvrant 365 jours d’accès ; il ne se renouvelle pas automatiquement à l’échéance.",
  ],
  paymentTitle: "4. Paiements et modalités d’utilisation",
  paymentIntro:
    "Les utilisateurs peuvent obtenir des crédits via un abonnement mensuel, un pass annuel ou des packs ponctuels. Les tarifs figurent sur la page des prix.",
  monthly:
    "Abonnement mensuel : prélèvement automatique chaque mois à la date prévue. Vous pouvez demander à tout moment depuis Mon compte l’annulation du prochain cycle ; l’accès continue jusqu’à la fin de la période déjà payée.",
  annual:
    "Pass annuel : paiement unique anticipé pour 12 mois (365 jours). Aucun renouvellement automatique ni nouveau prélèvement après un an ; le pass expire à la fin de la période d’accès.",
  packs: "Des packs de crédits peuvent être achetés séparément si nécessaire.",
  expiryTitle: "5. Expiration du pass annuel et rachat",
  expiryBullets: [
    "Le pass annuel expire automatiquement 365 jours après l’achat.",
    "Aucun prélèvement automatique n’a lieu à l’échéance.",
    "À l’échéance, la Société peut envoyer une notification dans le service et/ou par e-mail concernant la fin d’accès et le rachat au tarif normal. Le rachat nécessite votre confirmation et un paiement distinct.",
  ],
  refundTitle: "6. Remboursements et rétractation (important)",
  refundIntro:
    "Les remboursements suivent les règles applicables du commerce électronique et les critères ci-dessous, y compris chaque renouvellement mensuel, chaque pass 3 mois/annuel et chaque pack. Si les conditions sont remplies, un remboursement automatique peut être effectué via le prestataire (domestique : Toss/NHN KCP ; mondial : Stripe).",
  refundBullets: [
    "[Rétractation automatique] Dans les 7 jours suivant le paiement, si aucun crédit de ce paiement n’a été utilisé : remboursement intégral automatique approuvé et traité.",
    "[Limites] Si des crédits ont été utilisés ou si plus de 7 jours se sont écoulés : la rétractation est limitée une fois le contenu numérique fourni ; le remboursement automatique est en principe refusé.",
    "[Exception erreur système] En cas d’échec système (crédits débités sans résultat), le support/admin peut restaurer les crédits ou approuver un remboursement exceptionnel indépendamment du délai ou de l’usage.",
    "À la fin du remboursement, le statut de paiement est mis à jour et les crédits/droits de ce paiement sont repris.",
    "Si le remboursement automatique est refusé : 010-7778-1146 ou scd77777@naver.com.",
  ],
  aiTitle: "7. Résultats IA et droits",
  aiBullets: [
    "Les droits sur les photos téléversées restent à l’utilisateur.",
    "L’usage non autorisé de photos d’autrui, les deepfakes ou contenus illicites/obscènes peuvent entraîner une suspension immédiate. La responsabilité légale incombe à l’utilisateur.",
  ],
  restrictTitle: "8. Restrictions",
  restrict:
    "La Société peut restreindre l’usage ou suspendre des comptes en cas de violation, d’abus ou de paiement frauduleux.",
  contactTitle: "9. Contact",
  contact: "Questions : 010-7778-1146 ou scd77777@naver.com.",
});

export const TERMS_DE: LegalDocument = buildInternationalTerms({
  title: "Nutzungsbedingungen",
  purposeTitle: "1. Zweck",
  purpose:
    "Diese Bedingungen regeln die Nutzung von Studio Canvas AI (der „Dienst“) durch K-Wellness Hub Life (das „Unternehmen“), einschließlich KI-gestützter Porträt- und Lookbook-Erzeugung.",
  companyTitle: "2. Unternehmensangaben",
  definitionsTitle: "3. Definitionen",
  definitions: [
    "„Credits“ sind die Einheiten für kostenpflichtige Funktionen wie Generierung und Regenerierung.",
    "„Monatsabonnement“ ist ein wiederkehrender Plan, der monatlich am festgelegten Datum automatisch über die hinterlegte Zahlungsart abgebucht wird.",
    "„Jahrespass“ ist ein einmaliger Vorauskauf für 365 Tage Zugang und verlängert sich nach Ablauf nicht automatisch.",
  ],
  paymentTitle: "4. Zahlungen und Nutzungsformen",
  paymentIntro:
    "Nutzer können Credits über ein Monatsabonnement, einen Jahrespass oder Einmal-Credit-Packs erhalten. Preise und Leistungen stehen auf der Preisseite.",
  monthly:
    "Monatsabonnement: automatische Abbuchung jeden Monat am festgelegten Datum. Die Kündigung des nächsten Zyklus kann jederzeit unter „Mein Konto“ beantragt werden; der Zugang bleibt bis zum Ende der bereits bezahlten Periode bestehen.",
  annual:
    "Jahrespass: einmalige Vorauszahlung für 12 Monate (365 Tage). Nach einem Jahr erfolgt keine automatische Verlängerung oder erneute Abbuchung; der Pass endet mit Ablauf der Zugangsperiode.",
  packs: "Credit-Packs können bei Bedarf separat erworben werden.",
  expiryTitle: "5. Ablauf des Jahrespasses und erneuter Kauf",
  expiryBullets: [
    "Der Jahrespass endet automatisch 365 Tage nach dem Kauf.",
    "Zum Ablauf erfolgt keine automatische Kartenabbuchung.",
    "Zum Ablauf kann das Unternehmen eine In-Service- und/oder E-Mail-Benachrichtigung über den Ablauf und den erneuten Kauf zum regulären Preis senden. Der erneute Kauf erfordert Ihre gesonderte Bestätigung und Zahlung.",
  ],
  refundTitle: "6. Rückerstattung und Widerruf (wichtig)",
  refundIntro:
    "Rückerstattungen folgen den anwendbaren Regeln zum elektronischen Geschäftsverkehr und den folgenden Kriterien, auch für jede monatliche Verlängerung sowie für 3-Monats-/Jahrespass- und Pack-Zahlungen. Bei Erfüllung der Voraussetzungen kann eine automatische Erstattung über den Zahlungsanbieter (inländisch: Toss/NHN KCP; global: Stripe) erfolgen.",
  refundBullets: [
    "[Automatischer Widerruf] Innerhalb von 7 Tagen nach Zahlung und ohne Nutzung der dadurch gewährten Credits: volle automatische Rückerstattung wird genehmigt und ausgeführt.",
    "[Beschränkung] Wurden Credits genutzt oder sind mehr als 7 Tage vergangen: Widerruf ist nach Beginn der digitalen Bereitstellung eingeschränkt; automatische Rückerstattung wird grundsätzlich abgelehnt.",
    "[Systemfehler-Ausnahme] Bei Systemausfällen (Credits abgezogen, kein Ergebnis) können Support/Admin Credits wiederherstellen oder eine Ausnahmeerstattung unabhängig von Frist/Nutzung genehmigen.",
    "Nach Abschluss wird der Zahlungsstatus aktualisiert und Credits/Rechte aus dieser Zahlung eingezogen.",
    "Bei Ablehnung der Automatik: 010-7778-1146 oder scd77777@naver.com.",
  ],
  aiTitle: "7. KI-Ergebnisse und Urheberrecht",
  aiBullets: [
    "Rechte an hochgeladenen Fotos verbleiben beim Nutzer.",
    "Unbefugte Nutzung fremder Fotos, Deepfakes oder illegale/obszöne Inhalte können zur sofortigen Kontosperrung führen. Die rechtliche Verantwortung liegt beim Nutzer.",
  ],
  restrictTitle: "8. Nutzungseinschränkungen",
  restrict:
    "Bei Verstößen, Missbrauch oder betrügerischen Zahlungen kann das Unternehmen die Nutzung einschränken oder Konten sperren.",
  contactTitle: "9. Kontakt",
  contact: "Fragen: 010-7778-1146 oder scd77777@naver.com.",
});

export const TERMS_IT: LegalDocument = buildInternationalTerms({
  title: "Termini di servizio",
  purposeTitle: "1. Scopo",
  purpose:
    "I presenti Termini regolano l’uso di Studio Canvas AI (il “Servizio”) gestito da K-Wellness Hub Life (la “Società”), inclusa la generazione di ritratti e lookbook con IA.",
  companyTitle: "2. Informazioni societarie",
  definitionsTitle: "3. Definizioni",
  definitions: [
    "I “crediti” sono le unità del servizio necessarie per funzioni a pagamento come generazione e rigenerazione.",
    "L’“abbonamento mensile” è un piano ricorrente addebitato automaticamente nella data mensile prevista sul metodo di pagamento registrato.",
    "Il “pass annuale” è un acquisto prepagato una tantum che copre 365 giorni di accesso e non si rinnova automaticamente alla scadenza.",
  ],
  paymentTitle: "4. Pagamenti e modalità di utilizzo",
  paymentIntro:
    "Gli utenti possono ottenere crediti tramite abbonamento mensile, pass annuale o pack di crediti. Prezzi e benefici sono indicati nella pagina prezzi.",
  monthly:
    "Abbonamento mensile: addebito automatico ogni mese nella data prevista. È possibile richiedere in qualsiasi momento da La mia pagina la cancellazione del ciclo successivo; l’accesso continua fino alla fine del periodo già pagato.",
  annual:
    "Pass annuale: pagamento unico anticipato per 12 mesi (365 giorni). Dopo un anno la carta non viene addebitata di nuovo automaticamente e il pass scade al termine del periodo di accesso.",
  packs: "I pack di crediti possono essere acquistati separatamente se necessario.",
  expiryTitle: "5. Scadenza del pass annuale e riacquisto",
  expiryBullets: [
    "Il pass annuale scade automaticamente 365 giorni dopo l’acquisto.",
    "Alla scadenza non avviene alcun addebito automatico sulla carta.",
    "Alla scadenza la Società può inviare un avviso nel servizio e/o via e-mail sulla fine dell’accesso e sul riacquisto a prezzo pieno. Il riacquisto richiede conferma e pagamento separati.",
  ],
  refundTitle: "6. Rimborsi e recesso (importante)",
  refundIntro:
    "I rimborsi seguono le norme applicabili sul commercio elettronico e i criteri seguenti, anche per ogni rinnovo mensile e per ciascun pagamento di pass 3 mesi/annuale o pack. Se i requisiti sono soddisfatti, il servizio può rimborsare automaticamente tramite il provider (domestico: Toss/NHN KCP; globale: Stripe).",
  refundBullets: [
    "[Recesso automatico] Entro 7 giorni dal pagamento, se nessun credito di quel pagamento è stato usato: rimborso integrale automatico approvato ed eseguito.",
    "[Limiti] Se sono stati usati crediti o sono passati più di 7 giorni: il recesso è limitato una volta avviata la fornitura del contenuto digitale; il rimborso automatico è in genere rifiutato.",
    "[Eccezione errore di sistema] In caso di guasto (crediti scalati senza risultato), supporto/admin può ripristinare i crediti o approvare un rimborso eccezionale indipendentemente da termine o uso.",
    "Al completamento, lo stato del pagamento è aggiornato e crediti/diritti di quel pagamento sono recuperati.",
    "Se l’automatico è rifiutato: 010-7778-1146 o scd77777@naver.com.",
  ],
  aiTitle: "7. Output IA e diritti",
  aiBullets: [
    "I diritti sulle foto caricate restano dell’utente.",
    "L’uso non autorizzato di foto altrui, deepfake o contenuti illegali/osceni può comportare la sospensione immediata dell’account. La responsabilità legale è dell’utente.",
  ],
  restrictTitle: "8. Limitazioni",
  restrict:
    "La Società può limitare l’uso o sospendere gli account in caso di violazioni, abusi o pagamenti fraudolenti.",
  contactTitle: "9. Contatti",
  contact: "Domande: 010-7778-1146 o scd77777@naver.com.",
});

export const TERMS_VI: LegalDocument = buildInternationalTerms({
  title: "Điều khoản dịch vụ",
  purposeTitle: "1. Mục đích",
  purpose:
    "Các Điều khoản này điều chỉnh việc sử dụng Studio Canvas AI (“Dịch vụ”) do K-Wellness Hub Life (“Công ty”) vận hành, bao gồm tạo ảnh chân dung/lookbook bằng AI.",
  companyTitle: "2. Thông tin công ty",
  definitionsTitle: "3. Định nghĩa",
  definitions: [
    "“Credit” là đơn vị trong dịch vụ dùng cho các tính năng trả phí như tạo ảnh và tạo lại.",
    "“Gói tháng (Monthly Subscription)” là gói định kỳ được tự động tính phí vào ngày chỉ định mỗi tháng trên phương thức thanh toán đã đăng ký.",
    "“Gói năm (Annual Pass)” là mua trả trước một lần cho 365 ngày sử dụng và không tự động gia hạn khi hết hạn.",
  ],
  paymentTitle: "4. Thanh toán và hình thức sử dụng",
  paymentIntro:
    "Người dùng có thể nhận credit qua gói tháng, gói năm hoặc gói credit mua lẻ. Giá và quyền lợi theo trang bảng giá.",
  monthly:
    "Gói tháng: tự động trừ tiền mỗi tháng vào ngày chỉ định. Bạn có thể yêu cầu hủy chu kỳ tiếp theo bất cứ lúc nào tại Trang của tôi; quyền truy cập vẫn còn đến hết kỳ đã thanh toán.",
  annual:
    "Gói năm: thanh toán trước một lần cho 12 tháng (365 ngày). Sau một năm thẻ không bị trừ tiền tự động lại và gói hết hạn khi kết thúc thời hạn sử dụng.",
  packs: "Có thể mua thêm gói credit riêng khi cần.",
  expiryTitle: "5. Hết hạn gói năm và mua lại",
  expiryBullets: [
    "Gói năm tự động hết hạn sau 365 ngày kể từ ngày mua.",
    "Khi hết hạn không có khoản trừ thẻ tự động.",
    "Khi hết hạn, Công ty có thể gửi thông báo trong dịch vụ và/hoặc email về việc hết quyền sử dụng và hướng dẫn mua lại theo giá niêm yết. Việc mua lại cần xác nhận và thanh toán riêng của bạn.",
  ],
  refundTitle: "6. Hoàn tiền và hủy giao dịch (quan trọng)",
  refundIntro:
    "Hoàn tiền tuân theo quy định bảo vệ người tiêu dùng thương mại điện tử áp dụng và các tiêu chí dưới đây, gồm mỗi lần gia hạn gói tháng, mỗi thanh toán gói 3 tháng/năm và gói credit. Khi đủ điều kiện, dịch vụ có thể hoàn tự động qua nhà cung cấp thanh toán (trong nước: Toss/NHN KCP; toàn cầu: Stripe).",
  refundBullets: [
    "[Hủy tự động] Trong vòng 7 ngày sau thanh toán, nếu chưa dùng bất kỳ credit nào từ khoản đó: hoàn toàn bộ được duyệt và xử lý tự động.",
    "[Hạn chế] Nếu đã dùng credit hoặc đã quá 7 ngày: việc hủy bị hạn chế khi nội dung số đã bắt đầu cung cấp; hoàn tự động về nguyên tắc bị từ chối.",
    "[Ngoại lệ lỗi hệ thống] Nếu lỗi hệ thống khiến credit bị trừ mà không có kết quả, hỗ trợ/admin có thể khôi phục credit hoặc duyệt hoàn ngoại lệ bất kể thời hạn/sử dụng.",
    "Khi hoàn xong, trạng thái thanh toán được cập nhật và credit/quyền từ khoản đó được thu hồi đồng bộ.",
    "Nếu hoàn tự động bị từ chối: 010-7778-1146 hoặc scd77777@naver.com.",
  ],
  aiTitle: "7. Kết quả AI và bản quyền",
  aiBullets: [
    "Quyền đối với ảnh tải lên thuộc về người dùng.",
    "Sử dụng trái phép ảnh người khác, deepfake hoặc nội dung bất hợp pháp/khiêu dâm có thể dẫn đến khóa tài khoản ngay lập tức. Trách nhiệm pháp lý thuộc về người dùng.",
  ],
  restrictTitle: "8. Hạn chế sử dụng",
  restrict:
    "Công ty có thể hạn chế sử dụng hoặc khóa tài khoản nếu xác nhận vi phạm, lạm dụng hoặc thanh toán gian lận.",
  contactTitle: "9. Liên hệ",
  contact: "Liên hệ: 010-7778-1146 hoặc scd77777@naver.com.",
});

export const TERMS_HI: LegalDocument = buildInternationalTerms({
  title: "सेवा की शर्तें",
  purposeTitle: "1. उद्देश्य",
  purpose:
    "ये शर्तें K-Wellness Hub Life (“कंपनी”) द्वारा संचालित Studio Canvas AI (“सेवा”) के उपयोग को नियंत्रित करती हैं, जिसमें AI आधारित पोर्ट्रेट और लुकबुक जनरेशन शामिल है।",
  companyTitle: "2. कंपनी की जानकारी",
  definitionsTitle: "3. परिभाषाएँ",
  definitions: [
    "“क्रेडिट” भुगतान वाली सुविधाओं (जनरेशन/रीजनरेशन आदि) के लिए सेवा की इकाइयाँ हैं।",
    "“मासिक सदस्यता” प्रत्येक माह निर्धारित तिथि पर पंजीकृत भुगतान विधि से स्वतः बिल होने वाली आवर्ती योजना है।",
    "“वार्षिक पास” 365 दिनों की पहुँच के लिए एकमुश्त अग्रिम खरीदारी है और अवधि समाप्त होने पर स्वतः नवीनीकृत नहीं होता।",
  ],
  paymentTitle: "4. भुगतान और सेवा उपयोग का तरीका",
  paymentIntro:
    "उपयोगकर्ता मासिक सदस्यता, वार्षिक पास या एकमुश्त क्रेडिट पैक से क्रेडिट प्राप्त कर सकते हैं। कीमतें मूल्य पृष्ठ पर दर्शाई जाती हैं।",
  monthly:
    "मासिक सदस्यता: प्रत्येक माह निर्धारित तिथि पर स्वतः शुल्क। आप किसी भी समय माई पेज से अगले चक्र की रद्दीकरण का अनुरोध कर सकते हैं; पहले से भुगतान की गई अवधि के अंत तक पहुँच बनी रहती है।",
  annual:
    "वार्षिक पास: 12 महीने (365 दिन) के लिए एक बार का अग्रिम भुगतान। एक वर्ष बाद कार्ड से स्वतः नया शुल्क नहीं लिया जाता और पहुँच अवधि समाप्त होने पर पास समाप्त हो जाता है।",
  packs: "आवश्यक होने पर सदस्यता/पास से अलग क्रेडिट पैक खरीदे जा सकते हैं।",
  expiryTitle: "5. वार्षिक पास समाप्ति और पुनः खरीद",
  expiryBullets: [
    "वार्षिक पास खरीद के 365 दिन बाद स्वतः समाप्त होता है।",
    "समाप्ति पर कार्ड से स्वतः भुगतान नहीं होता।",
    "समाप्ति पर कंपनी सेवा में और/या ईमेल द्वारा पहुँच समाप्ति व नियमित मूल्य पर पुनः खरीद की जानकारी भेज सकती है। पुनः खरीद के लिए आपकी अलग पुष्टि और भुगतान आवश्यक है।",
  ],
  refundTitle: "6. रिफंड और निकासी (महत्वपूर्ण)",
  refundIntro:
    "रिफंड लागू ई-कॉमर्स उपभोक्ता संरक्षण नियमों और नीचे दिए मानदंडों के अनुसार होंगे, जिनमें प्रत्येक मासिक नवीनीकरण तथा 3-माह/वार्षिक पास/पैक भुगतान शामिल हैं। शर्तें पूरी होने पर सेवा भुगतान प्रदाता (घरेलू: Toss/NHN KCP; वैश्विक: Stripe) के माध्यम से स्वतः रिफंड कर सकती है।",
  refundBullets: [
    "[स्वचालित निकासी] भुगतान के 7 दिनों के भीतर, यदि उस भुगतान से मिले किसी भी क्रेडिट का उपयोग नहीं हुआ: पूर्ण स्वतः रिफंड स्वीकृत और संसाधित।",
    "[सीमाएँ] यदि क्रेडिट उपयोग हो चुके हैं या 7 दिन बीत चुके हैं: डिजिटल सामग्री की आपूर्ति शुरू होने पर निकासी सीमित; स्वतः रिफंड सामान्यतः अस्वीकृत।",
    "[सिस्टम त्रुटि अपवाद] सिस्टम विफलता से बिना परिणाम क्रेडिट कटने पर सपोर्ट/एडमिन अवधि/उपयोग की परवाह किए बिना क्रेडिट वापस या अपवाद रिफंड कर सकता है।",
    "रिफंड पूर्ण होने पर भुगतान स्थिति अपडेट होती है और उस भुगतान के क्रेडिट/अधिकार वापस लिए जाते हैं।",
    "स्वतः रिफंड अस्वीकृत हो तो: 010-7778-1146 या scd77777@naver.com।",
  ],
  aiTitle: "7. AI आउटपुट और कॉपीराइट",
  aiBullets: [
    "अपलोड की गई फ़ोटो के अधिकार उपयोगकर्ता के पास रहते हैं।",
    "दूसरों की फ़ोटो का अनधिकृत उपयोग, डीपफेक या अवैध/अश्लील सामग्री से खाता तुरंत निलंबित हो सकता है। कानूनी जिम्मेदारी उपयोगकर्ता की है।",
  ],
  restrictTitle: "8. उपयोग प्रतिबंध",
  restrict:
    "नियम उल्लंघन, दुरुपयोग या धोखाधड़ी भुगतान की पुष्टि होने पर कंपनी उपयोग प्रतिबंधित या खाता निलंबित कर सकती है।",
  contactTitle: "9. संपर्क",
  contact: "प्रश्न: 010-7778-1146 या scd77777@naver.com।",
});

export const PRIVACY_EN: LegalDocument = {
  title: "Privacy Policy",
  updatedAt: UPDATED_AT,
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

const TERMS_BY_LOCALE: Record<string, LegalDocument> = {
  kr: TERMS_KR,
  en: TERMS_EN,
  ja: TERMS_JA,
  zh: TERMS_ZH,
  es: TERMS_ES,
  fr: TERMS_FR,
  de: TERMS_DE,
  it: TERMS_IT,
  vi: TERMS_VI,
  hi: TERMS_HI,
};

export function getTermsDocument(locale: string): LegalDocument {
  return TERMS_BY_LOCALE[locale] ?? TERMS_EN;
}

export function getPrivacyDocument(locale: string): LegalDocument {
  return locale === "kr" ? PRIVACY_KR : PRIVACY_EN;
}
