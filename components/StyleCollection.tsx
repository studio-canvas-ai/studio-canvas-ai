"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import StyleHoverCard from "@/components/StyleHoverCard";
import StyleCompareHoverPopup, {
  previewAnchorFromZone,
  type StylePreviewAnchor,
  type StylePreviewSide,
} from "@/components/StyleCompareHoverPopup";
import {
  stylePacksMeta,
  CONCEPT_GROUP_IDS,
  CONCEPT_GROUP_EMOJI,
  type ConceptGroupId,
  type StylePackMeta,
} from "@/lib/data";
import { buildGenerateStyleHref } from "@/lib/generateSession";
import {
  ALL_STYLE_PREVIEW_PACK_IDS,
  preloadStylePreviewPair,
} from "@/lib/stylePreviewPairs";

const conceptTabs = ["all", ...CONCEPT_GROUP_IDS] as const;
/** Bridge so the cursor can travel card → zone-centered popup without flicker. */
const CLOSE_DELAY_MS = 280;

/**
 * Split packs into left / right 2×2 zones.
 * Full 8-pack gallery keeps the visual order of a 4-column grid:
 *   left  = cols 0–1  → [0,1,4,5]
 *   right = cols 2–3  → [2,3,6,7]
 */
function partitionIntoZones(packs: StylePackMeta[]): {
  left: StylePackMeta[];
  right: StylePackMeta[];
} {
  const isFullGallery =
    packs.length === stylePacksMeta.length &&
    packs.every((p, i) => p.id === stylePacksMeta[i]?.id);

  if (isFullGallery) {
    return {
      left: [packs[0], packs[1], packs[4], packs[5]],
      right: [packs[2], packs[3], packs[6], packs[7]],
    };
  }

  if (packs.length <= 2) {
    return { left: packs, right: [] };
  }

  const mid = Math.ceil(packs.length / 2);
  return { left: packs.slice(0, mid), right: packs.slice(mid) };
}

export default function StyleCollection({
  initialCategory = "all",
  layout = "landing",
}: {
  initialCategory?: ConceptGroupId | "all";
  /** `page` = dedicated /styles route under fixed navbar (tighter top). */
  layout?: "landing" | "page";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<ConceptGroupId | "all">(
    initialCategory
  );
  const [previewStyleId, setPreviewStyleId] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<StylePreviewAnchor | null>(
    null
  );
  const [popupOpen, setPopupOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewIdRef = useRef<string | null>(null);
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);

  const filtered =
    activeCategory === "all"
      ? stylePacksMeta
      : stylePacksMeta.filter((p) => p.conceptGroup === activeCategory);

  const { left: leftPacks, right: rightPacks } = useMemo(
    () => partitionIntoZones(filtered),
    [filtered]
  );

  const previewPack = previewStyleId
    ? stylePacksMeta.find((p) => p.id === previewStyleId) ?? null
    : null;
  const previewCopy = previewPack
    ? t.styles.packs[previewPack.id as keyof typeof t.styles.packs]
    : null;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    for (const id of ALL_STYLE_PREVIEW_PACK_IDS) {
      if (!t.styles.packs[id as keyof typeof t.styles.packs]) {
        console.warn(`[StyleCollection] missing i18n pack: ${id}`);
      }
    }
  }, [t.styles.packs]);

  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (cancelled) return;
      for (const id of ALL_STYLE_PREVIEW_PACK_IDS) {
        preloadStylePreviewPair(id);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleHandle = window.requestIdleCallback(() => run(), { timeout: 1500 });
    } else {
      timeoutHandle = setTimeout(run, 400);
    }

    return () => {
      cancelled = true;
      if (
        idleHandle != null &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) clearTimeout(timeoutHandle);
    };
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const measureZone = useCallback((side: StylePreviewSide) => {
    const zoneEl =
      side === "left" ? leftZoneRef.current : rightZoneRef.current;
    if (!zoneEl) return null;
    return previewAnchorFromZone(zoneEl, side);
  }, []);

  const openPreview = useCallback(
    (styleId: string, _cardEl?: HTMLElement | null, side?: StylePreviewSide) => {
      clearCloseTimer();
      previewIdRef.current = styleId;
      setPreviewStyleId(styleId);

      const resolvedSide: StylePreviewSide =
        side ??
        (rightPacks.some((p) => p.id === styleId) ? "right" : "left");
      const anchor = measureZone(resolvedSide);
      if (anchor) setPreviewAnchor(anchor);

      setPopupOpen(true);
      preloadStylePreviewPair(styleId);
    },
    [clearCloseTimer, measureZone, rightPacks]
  );

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setPopupOpen(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const handlePopupExited = useCallback(() => {
    if (!popupOpen) {
      setPreviewStyleId(null);
      setPreviewAnchor(null);
      previewIdRef.current = null;
    }
  }, [popupOpen]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  // Keep zone anchor fresh on resize/scroll while open
  useEffect(() => {
    if (!popupOpen || !previewStyleId) return;
    const side: StylePreviewSide = rightPacks.some((p) => p.id === previewStyleId)
      ? "right"
      : "left";
    const refresh = () => {
      const anchor = measureZone(side);
      if (anchor) setPreviewAnchor(anchor);
    };
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    };
  }, [popupOpen, previewStyleId, rightPacks, measureZone]);

  const handleViewAll = () => {
    setActiveCategory("all");
    router.push("/styles");
  };

  const goMakeWithStyle = (styleId: string) => {
    clearCloseTimer();
    setPopupOpen(false);
    setPreviewStyleId(null);
    setPreviewAnchor(null);
    router.push(buildGenerateStyleHref(styleId));
  };

  const renderZoneCards = (
    packs: StylePackMeta[],
    side: StylePreviewSide,
    indexOffset: number
  ) =>
    packs.map((pack, idx) => {
      const packT = t.styles.packs[pack.id as keyof typeof t.styles.packs];
      if (!packT) {
        console.warn(`[StyleCollection] skip pack without copy: ${pack.id}`);
        return null;
      }
      const isActive = previewStyleId === pack.id && popupOpen;
      return (
        <StyleHoverCard
          key={pack.id}
          pack={pack}
          name={packT.name}
          description={packT.description}
          badge={packT.badge ?? t.creator.conceptGroups[pack.conceptGroup]}
          tags={packT.tags}
          compositionLabel={t.creator.compositionTags[pack.composition]}
          animationDelay={`${(indexOffset + idx) * 0.06}s`}
          active={isActive}
          pointerMuted={popupOpen && !isActive}
          onHoverStart={(id, el) => openPreview(id, el, side)}
          onHoverEnd={scheduleClose}
          onMakeWithStyle={goMakeWithStyle}
          onActivate={(id, el) => openPreview(id, el, side)}
        />
      );
    });

  return (
    <section
      id="styles"
      className={
        layout === "page"
          ? "page-below-nav relative px-6 pb-10 sm:px-8 sm:pb-14 lg:px-10 lg:pb-16 xl:px-12"
          : "section-padding relative"
      }
    >
      <div className="ambient-glow -right-32 top-0 h-80 w-80 bg-glow-emerald/10" />

      <div className="relative mx-auto w-full max-w-full pt-3 sm:pt-4">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-sm font-medium tracking-widest text-glow-emerald uppercase">
              {t.styles.eyebrow}
            </span>
            <h2 className="font-display mt-2 text-3xl font-bold sm:text-4xl">
              {t.styles.title}
            </h2>
            <p className="mt-2 max-w-lg text-white/50">{t.styles.subtitle}</p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {conceptTabs.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 sm:px-4 ${
                    activeCategory === cat
                      ? "bg-white/10 text-white shadow-glow-sm"
                      : "text-white/40 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  {cat === "all"
                    ? t.creator.conceptGroups.all
                    : `${CONCEPT_GROUP_EMOJI[cat]} ${t.creator.conceptGroups[cat]}`}
                </button>
              ))}
            </div>
            {activeCategory !== "all" && (
              <p className="text-xs text-glow-emerald/80">
                ( {t.creator.conceptGroupHints[activeCategory]} )
              </p>
            )}
          </div>
        </div>

        {/* Two explicit 2×2 zones — popup centers inside the hovered zone */}
        <div
          className={`grid gap-3 sm:gap-4 ${
            rightPacks.length > 0 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          <div
            ref={leftZoneRef}
            data-style-zone="left"
            className="relative grid grid-cols-2 gap-3 sm:gap-4"
          >
            {renderZoneCards(leftPacks, "left", 0)}
          </div>

          {rightPacks.length > 0 ? (
            <div
              ref={rightZoneRef}
              data-style-zone="right"
              className="relative grid grid-cols-2 gap-3 sm:gap-4"
            >
              {renderZoneCards(rightPacks, "right", leftPacks.length)}
            </div>
          ) : null}
        </div>

        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={handleViewAll}
            className="btn-secondary group min-w-0 px-5 py-3"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-glow-purple" />
            <span className="truncate">{t.styles.viewAll}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>

      {previewPack && previewCopy ? (
        <StyleCompareHoverPopup
          styleId={previewPack.id}
          styleName={previewCopy.name}
          open={popupOpen}
          anchor={previewAnchor}
          onKeepOpen={() => {
            if (previewPack.id) openPreview(previewPack.id);
          }}
          onRequestClose={scheduleClose}
          onMakeWithStyle={goMakeWithStyle}
          onExited={handlePopupExited}
        />
      ) : null}
    </section>
  );
}
