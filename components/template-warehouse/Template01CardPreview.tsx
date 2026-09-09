"use client";

import {
  isModularTemplate01,
  isNestedTemplate01,
  isStructuredTemplate01,
  type Template01Card,
} from "@/lib/templateWarehouse";
import Template01ModularPreview from "@/components/template-warehouse/Template01ModularPreview";

/** Renders warehouse thumbnail for any Template 01 card layout type. */
export default function Template01CardPreview({ card }: { card: Template01Card }) {
  if (isModularTemplate01(card)) {
    return <Template01ModularPreview card={card} />;
  }

  if (isNestedTemplate01(card)) {
    const [leftBox, rightBox] = card.subBoxes;
    return (
      <div className="flex h-full w-full flex-col gap-1.5 bg-gradient-to-b from-blue-50 to-slate-200 p-2 sm:gap-2 sm:p-2.5">
        <div className="mx-auto flex shrink-0 items-center justify-center rounded-full bg-blue-700 px-2 py-1 text-center shadow-sm">
          <p className="line-clamp-1 text-[8px] font-bold text-white sm:text-[9px]">
            {card.badgeText}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-center rounded-md bg-blue-900 px-1.5 py-2 text-center shadow-md">
          <p className="line-clamp-2 text-[9px] font-bold leading-tight text-white sm:text-[10px]">
            {card.mainTitle}
          </p>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 sm:gap-1.5">
          {[leftBox, rightBox].map((box, i) =>
            box ? (
              <div
                key={`${card.id}-sub-${i}`}
                className="flex flex-col overflow-hidden rounded-md border border-blue-200 bg-slate-50 shadow-sm"
              >
                <div className="shrink-0 bg-blue-100 px-1 py-1 text-center">
                  <p className="line-clamp-2 text-[7px] font-bold text-blue-900 sm:text-[8px]">
                    {box.title}
                  </p>
                </div>
                <div className="min-h-0 flex-1 space-y-0.5 p-1">
                  {box.items?.slice(0, 4).map((item) => (
                    <p
                      key={item}
                      className="line-clamp-1 text-[7px] text-slate-700 sm:text-[8px]"
                    >
                      • {item}
                    </p>
                  ))}
                  {box.infoLines?.map((line) => (
                    <p
                      key={line}
                      className="line-clamp-2 text-[7px] leading-tight text-slate-700 sm:text-[8px]"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
        <div className="flex shrink-0 items-center justify-center rounded-md bg-slate-900 px-1.5 py-1.5 text-center shadow-md">
          <p className="line-clamp-2 text-[8px] font-semibold leading-tight text-white/95 sm:text-[9px]">
            {card.footerText}
          </p>
        </div>
      </div>
    );
  }

  if (isStructuredTemplate01(card)) {
    const cells = [...card.gridTexts];
    while (cells.length < 6) cells.push("");
    return (
      <div className="flex h-full w-full flex-col gap-1.5 bg-gradient-to-b from-teal-50 to-slate-200 p-2 sm:gap-2 sm:p-2.5">
        <div className="flex shrink-0 items-center justify-center rounded-md bg-teal-700 px-1.5 py-2 text-center shadow-md">
          <p className="line-clamp-2 text-[9px] font-bold leading-tight text-white sm:text-[10px]">
            {card.headerText}
          </p>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-1 sm:gap-1.5">
          {cells.slice(0, 6).map((label, i) => (
            <div
              key={`${card.id}-cell-${i}`}
              className="flex items-center justify-center rounded border border-teal-200/80 bg-white px-0.5 py-1 shadow-sm"
            >
              <p className="line-clamp-3 text-center text-[8px] font-semibold leading-tight text-slate-800 sm:text-[9px]">
                {label}
              </p>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-center rounded-md bg-teal-900 px-1.5 py-1.5 text-center shadow-md">
          <p className="line-clamp-2 text-[8px] font-semibold leading-tight text-white/95 sm:text-[9px]">
            {card.footerText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.bg}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-2.5 sm:p-3">
        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white drop-shadow sm:text-[12px]">
          {card.text1}
        </p>
        <p className="line-clamp-2 text-[10px] leading-snug text-white/85 drop-shadow sm:text-[11px]">
          {card.text2}
        </p>
      </div>
    </div>
  );
}
