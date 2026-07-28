"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, ImageIcon, Share2, Trash2, Wand2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import FaceProfilePanel from "@/components/FaceProfilePanel";
import {
  getAccountMeta,
  listGalleryHistory,
  deleteGalleryHistory,
  type GalleryHistoryItem,
} from "@/lib/faceProfiles";
import { fetchOriginalAsset } from "@/lib/galleryUpload";
import { downloadImageFile } from "@/lib/downloadImage";
import {
  daysUntilExpiry,
  retentionContextFromAccount,
  shouldShowActiveRetentionBanner,
  shouldShowExpiryBadge,
} from "@/lib/retentionPolicy";

type TabId = "works" | "models";

export default function MyGalleryTabs() {
  const { t } = useI18n();
  const { planId } = useCredits();
  const [tab, setTab] = useState<TabId>("works");
  const [works, setWorks] = useState<GalleryHistoryItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const retentionCtx = useMemo(
    () => retentionContextFromAccount(planId, getAccountMeta()),
    [planId]
  );

  const showActiveBanner = shouldShowActiveRetentionBanner(planId);

  useEffect(() => {
    setWorks(listGalleryHistory());
  }, [tab, planId]);

  const resolveDownloadUrl = async (item: GalleryHistoryItem): Promise<string> => {
    const storageId = item.storageId ?? item.id;
    if (item.originalKey || item.storageId) {
      const blob = await fetchOriginalAsset(storageId);
      if (blob) return URL.createObjectURL(blob);
    }
    return item.thumbnailUrl ?? item.imageUrl;
  };

  const handleDownload = async (item: GalleryHistoryItem) => {
    setBusyId(item.id);
    try {
      const imageUrl = await resolveDownloadUrl(item);
      await downloadImageFile({
        imageUrl,
        filename: `studio-canvas-${item.id}.png`,
        aspectRatio: "9:16",
        exportPreset: "original",
        printPaper: "a4",
      });
      if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    } catch {
      window.open(item.thumbnailUrl ?? item.imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusyId(null);
    }
  };

  const handleShare = async (item: GalleryHistoryItem) => {
    setBusyId(item.id);
    try {
      const imageUrl = await resolveDownloadUrl(item);
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
      const file = new File([blob], `studio-canvas-${item.id}.png`, { type: blob.type });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Studio Canvas AI",
          text: t.thumbnail.shareText,
        });
        return;
      }
      const kakaoUrl = `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(window.location.href)}`;
      window.open(kakaoUrl, "_blank", "noopener,noreferrer");
    } catch {
      const kakaoUrl = `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(window.location.href)}`;
      window.open(kakaoUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (item: GalleryHistoryItem) => {
    if (!window.confirm(t.gallery.worksDeleteConfirm)) return;
    setWorks(deleteGalleryHistory(item.id));
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "works", label: t.gallery.tabWorks },
    { id: "models", label: t.gallery.tabModels },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === item.id
                ? "bg-glow-purple/20 text-white shadow-glow-sm"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "works" && (
        <div className="space-y-4">
          {showActiveBanner && (
            <div className="rounded-xl border border-glow-emerald/30 bg-glow-emerald/10 px-4 py-3 text-sm text-emerald-100/90">
              {t.gallery.retentionActiveBanner}
            </div>
          )}

          {works.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center gap-3 p-10 text-center">
              <ImageIcon className="h-10 w-10 text-white/25" />
              <p className="text-sm text-white/50">{t.gallery.worksEmpty}</p>
              <Link href="/generate" className="btn-primary mt-2 px-5 py-2.5 text-sm">
                {t.nav.creator}
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {works.map((item) => {
                const daysLeft = daysUntilExpiry(item.expiresAt);
                const showExpiry = shouldShowExpiryBadge(retentionCtx, item.expiresAt);
                return (
                  <div
                    key={item.id}
                    className="glass-card overflow-hidden rounded-2xl border border-white/10"
                  >
                    <div className="relative aspect-[9/16] overflow-hidden bg-white/5">
                      <img
                        src={item.thumbnailUrl ?? item.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {showExpiry && daysLeft != null && (
                        <div className="absolute top-2 left-2 right-2 rounded-lg border border-amber-400/40 bg-amber-500/90 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-black">
                          {t.gallery.expiryBadge.replace("{days}", String(daysLeft))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 p-3">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleDownload(item)}
                        className="btn-secondary inline-flex flex-1 items-center justify-center gap-1.5 py-2 text-xs disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t.gallery.worksDownload}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleShare(item)}
                        className="btn-secondary inline-flex flex-1 items-center justify-center gap-1.5 py-2 text-xs disabled:opacity-50"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        {t.gallery.worksShare}
                      </button>
                      <Link
                        href="/generate"
                        className="btn-primary inline-flex flex-1 items-center justify-center gap-1.5 py-2 text-xs"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        {t.gallery.worksReedit}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-400/30 bg-red-500/10 py-2 text-xs text-red-200 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t.gallery.worksDelete}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "models" && <FaceProfilePanel />}
    </div>
  );
}
