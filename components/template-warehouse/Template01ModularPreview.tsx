"use client";

import {
  isModularTemplate01,
  resolveModularCardBlocks,
  type Template01Card,
} from "@/lib/templateWarehouse";

function textOf(
  card: Extract<Template01Card, { layoutType: "modular-block-system" }>,
  type: string
) {
  return resolveModularCardBlocks(card).find((b) => b.type === type)?.text ?? "";
}

/** A4 modular poster thumbnail — navy / gold / gray pro palette. */
export default function Template01ModularPreview({ card }: { card: Template01Card }) {
  if (!isModularTemplate01(card)) return null;

  const heroTitle =
    card.heroBanner?.title ?? textOf(card, "hero-title");
  const heroSub =
    card.heroBanner?.subtitle ?? textOf(card, "hero-sub");
  const circles =
    card.circularItems?.length === 3
      ? card.circularItems
      : ["circle-1", "circle-2", "circle-3"].map((t) => textOf(card, t));
  const leftCard = card.comparisonCards?.[0];
  const rightCard = card.comparisonCards?.[1];
  const steps =
    card.stepFlow?.length === 4
      ? card.stepFlow
      : ["step-1", "step-2", "step-3", "step-4"].map((t) => textOf(card, t));
  const footer = card.footerText ?? textOf(card, "footer");

  return (
    <div className="flex h-full w-full flex-col gap-1 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 p-2 sm:gap-1.5 sm:p-2.5">
      <div className="relative shrink-0 overflow-hidden rounded-lg bg-[#0F172A] px-2 py-2 text-center shadow-md ring-1 ring-[#C9A227]/40">
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        <p className="line-clamp-2 text-[8px] font-bold leading-tight text-white sm:text-[9px]">
          {heroTitle}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F5E6B8] px-1.5 py-1 text-center ring-1 ring-[#C9A227]/30">
        <p className="line-clamp-1 text-[7px] font-semibold text-[#1E293B] sm:text-[8px]">
          {heroSub}
        </p>
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-1">
        {circles.map((label, i) => (
          <div
            key={`c-${i}`}
            className="flex aspect-square items-center justify-center overflow-hidden rounded-full border-2 border-[#C9A227] bg-white px-0.5 shadow-sm"
          >
            <p className="line-clamp-3 text-center text-[6px] font-semibold leading-tight text-[#334155] sm:text-[7px]">
              {label}
            </p>
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-1">
        {[leftCard, rightCard].map((cmp, i) => (
          <div
            key={`cmp-${i}`}
            className="flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
          >
            <div className="shrink-0 bg-[#1E293B] px-1 py-1 text-center">
              <p className="line-clamp-2 text-[6px] font-bold leading-tight text-white sm:text-[7px]">
                {cmp?.title ??
                  textOf(card, i === 0 ? "card-l-title" : "card-r-title")}
              </p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-0.5 bg-[#F8FAFC] px-1 py-1">
              <p className="line-clamp-2 text-center text-[6px] font-medium text-[#64748B] sm:text-[7px]">
                {(cmp?.supportText ??
                  textOf(
                    card,
                    i === 0 ? "card-l-support" : "card-r-support"
                  )) ||
                  " "}
              </p>
              <p className="line-clamp-1 text-center text-[7px] font-bold text-[#B8860B] sm:text-[8px]">
                {(cmp?.amount ??
                  textOf(
                    card,
                    i === 0 ? "card-l-amount" : "card-r-amount"
                  )) ||
                  " "}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        {steps.map((step, i) => (
          <div
            key={`s-${i}`}
            className={`flex items-center gap-1 overflow-hidden rounded-md px-1 py-0.5 ${
              i % 2 === 0 ? "bg-[#E2E8F0]" : "bg-[#F1F5F9]"
            }`}
          >
            <span className="h-2 w-0.5 shrink-0 rounded-full bg-[#C9A227]" />
            <p className="line-clamp-1 text-[6px] font-medium text-[#1E293B] sm:text-[7px]">
              {step}
            </p>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0F172A] px-1.5 py-1 text-center shadow-md">
        <p className="line-clamp-1 text-[7px] font-semibold text-[#D4AF37] sm:text-[8px]">
          {footer}
        </p>
      </div>
    </div>
  );
}
