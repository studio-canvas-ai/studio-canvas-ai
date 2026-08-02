"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  stylePacksMeta,
  CONCEPT_GROUP_IDS,
  CONCEPT_GROUP_EMOJI,
  type ConceptGroupId,
} from "@/lib/data";

const conceptTabs = ["all", ...CONCEPT_GROUP_IDS] as const;

export default function StyleCollection({
  initialCategory = "all",
}: {
  initialCategory?: ConceptGroupId | "all";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<ConceptGroupId | "all">(initialCategory);

  const filtered =
    activeCategory === "all"
      ? stylePacksMeta
      : stylePacksMeta.filter((p) => p.conceptGroup === activeCategory);

  const handleViewAll = () => {
    setActiveCategory("all");
    router.push("/styles");
  };

  return (
    <section id="styles" className="section-padding relative">
      <div className="ambient-glow -right-32 top-0 h-80 w-80 bg-glow-emerald/10" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <span className="text-sm font-medium tracking-widest text-glow-emerald uppercase">
              {t.styles.eyebrow}
            </span>
            <h2 className="font-display mt-3 text-3xl font-bold sm:text-4xl">{t.styles.title}</h2>
            <p className="mt-4 max-w-lg text-white/50">{t.styles.subtitle}</p>
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

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pack, idx) => {
            const packT = t.styles.packs[pack.id as keyof typeof t.styles.packs];
            if (!packT) return null;
            return (
              <article
                key={pack.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/generate?style=${pack.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    router.push(`/generate?style=${pack.id}`);
                  }
                }}
                className="glass-card-hover group relative cursor-pointer overflow-hidden"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={pack.imageUrl}
                    alt={packT.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div
                    className={`absolute inset-0 bg-gradient-to-t ${pack.gradient} via-transparent to-transparent opacity-60`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/20 to-transparent" />

                  <div className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:opacity-100">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>

                  <div className="absolute right-4 bottom-4 left-4">
                    <span className="mb-2 inline-block rounded-full border border-white/20 bg-black/60 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white backdrop-blur-md">
                      {`${CONCEPT_GROUP_EMOJI[pack.conceptGroup]} ${packT.badge ?? t.creator.conceptGroups[pack.conceptGroup]}`}
                    </span>
                    <h3 className="font-display text-lg font-semibold leading-tight sm:text-xl">
                      {packT.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-zinc-100 sm:text-sm">
                      {packT.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-md border border-violet-400/50 bg-violet-950/60 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                        {t.creator.compositionTags[pack.composition]}
                      </span>
                      {packT.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                        >
                          {`#${tag}`}
                        </span>
                      ))}
                    </div>
                    <span className="btn-primary mt-3 flex w-full items-center justify-center gap-1 py-2.5 text-sm font-bold text-white shadow-md">
                      {t.creator.makeWithStyle}
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <button type="button" onClick={handleViewAll} className="btn-secondary group min-w-0 px-5 py-3">
            <Sparkles className="h-4 w-4 shrink-0 text-glow-purple" />
            <span className="truncate">{t.styles.viewAll}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
