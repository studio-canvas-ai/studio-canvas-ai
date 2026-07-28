"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Sparkles } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import {
  RELEASE_NOTES,
  getUnseenReleaseIds,
  markReleasesSeen,
} from "@/lib/releaseNotes";
import { getAccountMeta, patchAccountMeta } from "@/lib/faceProfiles";

export default function ReturnUserModal() {
  const { t, locale } = useI18n();
  const { isAuthenticated, requestSubscribe, setShowReturnModal, showReturnModal } =
    useCredits();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(RELEASE_NOTES);

  useEffect(() => {
    if (!isAuthenticated) return;
    const meta = getAccountMeta();
    const unseen = getUnseenReleaseIds();
    const isReturn =
      Boolean(meta.cancelledAt || meta.hadPaidPlan) || unseen.length > 0;
    if (!isReturn) return;
    if (meta.dormantNotifiedAt && Date.now() - meta.dormantNotifiedAt < 86_400_000) {
      return;
    }
    setNotes(RELEASE_NOTES.filter((n) => unseen.includes(n.id) || unseen.length === 0));
    setOpen(true);
    setShowReturnModal(true);
    patchAccountMeta({ lastLoginAt: Date.now(), dormantNotifiedAt: Date.now() });
  }, [isAuthenticated, setShowReturnModal]);

  const visible = open || showReturnModal;
  if (!visible) return null;

  const close = () => {
    markReleasesSeen(RELEASE_NOTES.map((n) => n.id));
    setOpen(false);
    setShowReturnModal(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-navy/80 backdrop-blur-sm" onClick={close} />
      <div className="glass-card relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto p-6 sm:p-8">
        <button type="button" onClick={close} className="absolute top-4 right-4 p-1.5 text-white/40">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-3 inline-flex items-center gap-2 text-glow-emerald">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-medium tracking-wider uppercase">{t.returnUser.badge}</span>
        </div>
        <h2 className="mb-2 text-xl font-semibold">{t.returnUser.title}</h2>
        <p className="mb-4 text-sm text-white/50">{t.returnUser.desc}</p>
        <p className="mb-3 text-xs text-white/40">{t.returnUser.dataKept}</p>
        <ul className="mb-5 space-y-2">
          {(notes.length ? notes : RELEASE_NOTES).flatMap((n) =>
            n.highlights.map((h, i) => (
              <li
                key={`${n.id}-${i}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75"
              >
                {locale === "kr" ? h.kr : h.en}
              </li>
            ))
          )}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn-primary flex-1 py-2.5 text-sm"
            onClick={() => {
              close();
              requestSubscribe("standard");
            }}
          >
            {t.returnUser.resubscribe}
          </button>
          <Link href="/gallery/my" onClick={close} className="btn-secondary flex-1 py-2.5 text-center text-sm">
            {t.returnUser.manageProfiles}
          </Link>
        </div>
      </div>
    </div>
  );
}
