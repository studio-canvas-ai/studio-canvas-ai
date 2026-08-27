"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { LegalDocument } from "@/lib/legalContent";

export default function LegalDocumentView({
  doc,
  backLabel = "Home",
}: {
  doc: LegalDocument;
  backLabel?: string;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white/75"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <header className="mb-10 border-b border-white/[0.08] pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-3 text-sm text-white/40">Updated {doc.updatedAt}</p>
      </header>

      <div className="space-y-10">
        {doc.sections.map((section) => (
          <section key={section.title} className="scroll-mt-28">
            <h2 className="mb-3 text-lg font-semibold text-white/90">
              {section.title}
            </h2>
            {section.paragraphs?.map((p) => (
              <p
                key={p.slice(0, 48)}
                className="mb-3 text-[15px] leading-7 text-white/65"
              >
                {p}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <ul className="mt-2 list-none space-y-2.5 border-l border-white/10 pl-4">
                {section.bullets.map((b, i) => (
                  <li
                    key={`${section.title}-${i}`}
                    className="text-[15px] leading-7 text-white/65"
                  >
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}
            {section.callouts && section.callouts.length > 0 ? (
              <div className="mt-5 space-y-3">
                {section.callouts.map((callout) => (
                  <aside
                    key={`${section.title}-${callout.label}`}
                    className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.08] via-white/[0.03] to-transparent p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:p-5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/85">
                      {callout.label}
                    </p>
                    <p className="mt-2.5 text-[15px] font-medium leading-7 text-white/88 sm:text-base sm:leading-8">
                      “{callout.text}”
                    </p>
                  </aside>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
