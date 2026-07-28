"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ImageIcon, Share2, Wand2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import FaceProfilePanel from "@/components/FaceProfilePanel";
import { listGalleryHistory, type GalleryHistoryItem } from "@/lib/faceProfiles";
import { downloadImageFile } from "@/lib/downloadImage";

type TabId = "works" | "models";

export default function MyGalleryTabs() {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("works");
  const [works, setWorks] = useState<GalleryHistoryItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setWorks(listGalleryHistory());
  }, [tab]);

  const handleDownload = async (item: GalleryHistoryItem) => {
    setBusyId(item.id);
    try {
      await downloadImageFile({
        imageUrl: item.imageUrl,
        filename: `studio-canvas-${item.id}.png`,
        aspectRatio: "9:16",
        exportPreset: "original",
        printPaper: "a4",
      });
    } catch {
      window.open(item.imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusyId(null);
    }
  };

  const handleShare = async (item: GalleryHistoryItem) => {
    setBusyId(item.id);
    try {
      const res = await fetch(item.imageUrl);
      const blob = await res.blob();
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
              {works.map((item) => (
                <div
                  key={item.id}
                  className="glass-card overflow-hidden rounded-2xl border border-white/10"
                >
                  <div className="aspect-[9/16] overflow-hidden bg-white/5">
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
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
                      className="btn-primary inline-flex w-full items-center justify-center gap-1.5 py-2 text-xs"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      {t.gallery.worksReedit}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "models" && <FaceProfilePanel />}
    </div>
  );
}
