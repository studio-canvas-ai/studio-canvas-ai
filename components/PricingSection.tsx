"use client";

import { useState } from "react";
import { Check, Flame, Sparkles, Zap } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import {
  PLAN_OFFERS,
  type BillingInterval,
  type PlanOffer,
} from "@/lib/data";

function planName(offer: PlanOffer) {
  if (offer.planId === "enterprise") return "Enterprise";
  if (offer.planId === "standard") return "Standard";
  if (offer.planId === "pro") return "Pro";
  return "Starter";
}

function features(offer: PlanOffer, ko: boolean) {
  const list = [
    ko
      ? `${offer.credits.toLocaleString()} 크레딧${offer.highlighted ? " 🚀" : ""}`
      : `${offer.credits.toLocaleString()} credits${offer.highlighted ? " 🚀" : ""}`,
    ko
      ? `사진 슬롯 ${offer.profileSlots}개`
      : `${offer.profileSlots} photo slot${offer.profileSlots > 1 ? "s" : ""}`,
    offer.resolution === "4K"
      ? ko
        ? "4K 초고화질"
        : "4K ultra quality"
      : "FHD (1080p)",
  ];
  if (offer.fastGeneration)
    list.push(ko ? "대기 없는 빠른 생성" : "No-wait fast generation");
  if (offer.commercialUse)
    list.push(ko ? "상업적 이용 가능" : "Commercial use allowed");
  if (offer.permanentStorage)
    list.push(ko ? "무제한 영구 보관" : "Unlimited permanent storage");
  if (offer.dedicatedLane)
    list.push(ko ? "전용 생성 라인" : "Dedicated generation lane");
  if (offer.interval === "annual" || offer.planId !== "starter")
    list.push(ko ? "워터마크 완벽 제거" : "Full watermark removal");
  return list;
}

export default function PricingSection() {
  const { t, locale } = useI18n();
  const { requestSubscribe, setShowTopUpModal } = useCredits();
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const ko = locale === "kr";
  const offers = PLAN_OFFERS[interval];

  return (
    <section id="pricing" className="section-padding relative">
      <div className="ambient-glow bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 bg-glow-purple/10" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <span className="text-sm font-medium tracking-widest text-glow-purple uppercase">
            {t.pricing.eyebrow}
          </span>
          <h2 className="font-display mt-3 text-3xl font-bold sm:text-4xl">
            {ko ? "화보 프로필 & 썸네일 제작 무적! 🚀" : "Unbeatable portraits & thumbnails! 🚀"}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-white/50 [word-break:keep-all]">
            {ko
              ? "유튜버, 크리에이터, 프로필이 필요한 모든 이를 위한 AI 비주얼 스튜디오. 고화질 AI 화보와 시선 강탈 썸네일을 3초 만에 완성해 보세요."
              : "The AI visual studio for YouTubers, creators, and anyone who needs a standout profile. Create high-resolution AI portraits and attention-grabbing thumbnails in seconds."}
          </p>

          <div className="mx-auto mt-7 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setInterval("annual")}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                interval === "annual"
                  ? "bg-gradient-to-r from-glow-purple to-glow-emerald text-white shadow-glow-sm"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" />
                {ko ? "연간 결제 (🔥 최대 30% 할인 적용 중)" : "Annual billing (up to 30% off)"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                interval === "monthly"
                  ? "bg-white/10 text-white"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              {ko ? "월간 결제" : "Monthly billing"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {offers.map((offer) => {
            const highlighted = offer.highlighted;
            return (
              <div
                key={`${offer.interval}-${offer.planId}`}
                className={`relative rounded-2xl p-[1px] transition-all duration-500 ${
                  highlighted
                    ? "bg-gradient-to-b from-glow-purple/70 via-glow-emerald/35 to-glow-purple/20 shadow-glow"
                    : "bg-white/[0.08]"
                }`}
              >
                <div
                  className={`flex h-full flex-col rounded-2xl p-5 sm:p-8 ${
                    highlighted
                      ? "bg-navy-light"
                      : "glass-card !rounded-2xl !border-0 !shadow-none"
                  }`}
                >
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-glow-purple to-glow-emerald px-4 py-1 text-xs font-semibold text-white shadow-glow-sm">
                        <Sparkles className="h-3 w-3" />
                        {ko ? "초강력 추천" : "Highly recommended"}
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="text-xl font-semibold text-white">{planName(offer)}</h3>
                    <p className="mt-1 text-sm text-white/40">
                      {offer.interval === "annual"
                        ? ko
                          ? "연간 구독"
                          : "Annual subscription"
                        : ko
                          ? "월간 구독"
                          : "Monthly subscription"}
                    </p>
                  </div>

                  <div className="mb-7">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">${offer.monthlyUsd}</span>
                      <span className="text-sm text-white/45">{t.pricing.perMonth}</span>
                    </div>
                    {offer.interval === "annual" && (
                      <p className="mt-2 text-xs text-white/40">
                        {ko
                          ? `연 $${offer.totalUsd} 일시불`
                          : `$${offer.totalUsd} billed once per year`}
                      </p>
                    )}
                  </div>

                  <ul className="mb-8 flex-1 space-y-3">
                    {features(offer, ko).map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            highlighted ? "bg-glow-purple/20" : "bg-white/5"
                          }`}
                        >
                          <Check
                            className={`h-3 w-3 ${
                              highlighted ? "text-glow-purple" : "text-white/50"
                            }`}
                          />
                        </div>
                        <span className="text-sm leading-snug text-slate-200">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => requestSubscribe(offer.planId, interval)}
                    className={`w-full rounded-xl py-3 text-center text-sm font-medium transition ${
                      highlighted
                        ? "btn-primary"
                        : "inline-flex items-center justify-center border border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    {highlighted && <Zap className="mr-2 h-4 w-4" />}
                    {highlighted ? t.pricing.getStarted : t.pricing.selectPlan}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-white/35">
          {ko
            ? "플랜 업그레이드 시 남은 기간의 가치를 차감한 차액만 결제되며, 기존 잔여 크레딧은 100% 이월됩니다."
            : "Upgrades charge only the prorated difference, and all remaining credits roll over."}
        </p>

        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
          <h3 className="text-lg font-semibold text-white">{t.pricing.addonTitle}</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/45">
            {t.pricing.addonSubtitle}
          </p>
          <button
            type="button"
            onClick={() => setShowTopUpModal(true)}
            className="btn-primary mt-5 px-6 py-2.5 text-sm"
          >
            <Zap className="h-4 w-4" />
            {t.credits.charge}
          </button>
        </div>
      </div>
    </section>
  );
}
