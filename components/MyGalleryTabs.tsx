"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, ImageIcon, Lock, Share2, Sparkles, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import FaceProfilePanel from "@/components/FaceProfilePanel";
import GeneralPhotosPanel from "@/components/GeneralPhotosPanel";
import {
  getAccountMeta,
  fetchGalleryHistoryFromServer,
  deleteGalleryHistoryAsync,
  GALLERY_UPDATED_EVENT,
  type GalleryHistoryItem,
} from "@/lib/faceProfiles";
import { fetchOriginalAsset } from "@/lib/galleryUpload";
import {
  downloadGalleryWorkLocally,
  type GalleryDownloadQuality,
} from "@/lib/galleryWorkDownload";
import { KAKAO_REGISTERED_ORIGIN, shareImageViaKakao } from "@/lib/kakaoShare";
import { isShareAbortError, shareWithFallback } from "@/lib/webShare";
import {
  daysUntilExpiry,
  retentionContextFromAccount,
  shouldShowActiveRetentionBanner,
  shouldShowExpiryBadge,
} from "@/lib/retentionPolicy";
import { clearResultSession } from "@/lib/resultSession";
import { isUnlimitedAccountEmail } from "@/lib/unlimitedAccount";
import { getPlanUsageLimits } from "@/lib/planQuotas";
import { useDownloadQuota } from "@/lib/useDownloadQuota";

type TabId = "works" | "models" | "photos";

function parseTab(raw: string | null): TabId {
  if (raw === "models") return "models";
  if (raw === "photos") return "photos";
  return "works";
}

export default function MyGalleryTabs() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { planId, isFreePlan, authUser, planUsage, billingInterval } =
    useCredits();
  const {
    fhdRemaining,
    uhd4kRemaining,
    standardLabel,
    highLabel,
    spendForQuality,
    quotaEmptyMessage,
  } = useDownloadQuota();
  const { confirm, showToast } = useFeedback();
  const [tab, setTab] = useState<TabId>(() => parseTab(searchParams.get("tab")));
  const [works, setWorks] = useState<GalleryHistoryItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const galleryLimit = useMemo(() => {
    if (planUsage?.galleryLimit != null) return planUsage.galleryLimit;
    return getPlanUsageLimits(planId, billingInterval).gallery;
  }, [billingInterval, planId, planUsage?.galleryLimit]);

  const canAccessAiModels =
    !isFreePlan || isUnlimitedAccountEmail(authUser?.email);

  const retentionCtx = useMemo(
    () => retentionContextFromAccount(planId, getAccountMeta()),
    [planId]
  );

  const showActiveBanner = shouldShowActiveRetentionBanner(planId);

  useEffect(() => {
    const next = parseTab(searchParams.get("tab"));
    if (next === "models" && !canAccessAiModels) {
      setTab("works");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      const qs = params.toString();
      router.replace(`/gallery/my${qs ? `?${qs}` : ""}`, { scroll: false });
      return;
    }
    setTab(next);
  }, [searchParams, canAccessAiModels, router]);

  useEffect(() => {
    void fetchGalleryHistoryFromServer().then(setWorks);
  }, [tab, planId]);

  useEffect(() => {
    const refresh = () => {
      void fetchGalleryHistoryFromServer().then(setWorks);
    };
    window.addEventListener(GALLERY_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(GALLERY_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const selectTab = async (next: TabId) => {
    if (next === "models" && !canAccessAiModels) {
      const goPricing = await confirm({
        title: t.gallery.modelsLockedTitle,
        message: t.gallery.modelsLockedMessage,
        confirmLabel: t.gallery.modelsLockedCta,
        cancelLabel: t.gallery.modelsLockedCancel,
      });
      if (goPricing) router.push("/pricing");
      return;
    }

    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "works") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`/gallery/my${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const resolveDownloadUrl = async (item: GalleryHistoryItem): Promise<string> => {
    const storageId = item.storageId ?? item.id;
    if (item.originalKey || item.storageId) {
      const blob = await fetchOriginalAsset(storageId);
      if (blob) return URL.createObjectURL(blob);
    }
    return item.thumbnailUrl ?? item.imageUrl;
  };

  const handleDownload = async (
    item: GalleryHistoryItem,
    quality: GalleryDownloadQuality
  ) => {
    const remaining = quality === "high" ? uhd4kRemaining : fhdRemaining;
    if (remaining < 1) {
      showToast(quotaEmptyMessage, "error");
      return;
    }
    setBusyId(item.id);
    try {
      const spent = await spendForQuality(quality);
      if (!spent.ok) {
        showToast(quotaEmptyMessage, "error");
        return;
      }
      await downloadGalleryWorkLocally(item, quality);
      showToast(
        quality === "high"
          ? t.gallery.worksDownloadHigh
          : t.gallery.worksDownloadStandard,
        "success"
      );
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
      const file = new File([blob], `studio-canvas-${item.id}.png`, {
        type: blob.type || "image/png",
      });

      try {
        const mode = await shareImageViaKakao({
          file,
          publicImageUrl: null,
          title: "Studio Canvas AI",
          description: t.thumbnail.shareText,
          linkUrl: KAKAO_REGISTERED_ORIGIN,
          buttonTitle: t.thumbnail.kakaoShareOpen,
        });
        if (mode === "kakao") return;
      } catch (err) {
        console.warn("[MyGalleryTabs] Kakao Share failed", err);
      }

      const result = await shareWithFallback({
        title: "Studio Canvas AI",
        text: t.thumbnail.shareText,
        url: KAKAO_REGISTERED_ORIGIN,
        file,
      });
      if (result === "copied") {
        showToast(t.creator.shareCopied, "success");
      }
    } catch (err) {
      if (isShareAbortError(err)) return;
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast(t.creator.shareCopied, "success");
      } catch {
        showToast(t.thumbnail.shareFailed, "error");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handlePortraitFromWork = (item: GalleryHistoryItem) => {
    clearResultSession();
    const imageUrl = item.imageUrl || item.thumbnailUrl;
    if (!imageUrl) {
      router.push("/generate");
      return;
    }
    const params = new URLSearchParams();
    params.set("intent", "portrait");
    params.set("workId", item.id);
    if (item.styleId) params.set("style", item.styleId);
    if (item.profileId) params.set("profileId", item.profileId);
    params.set("photoUrl", encodeURIComponent(imageUrl));
    router.push(`/generate?${params.toString()}`);
  };

  const handleDelete = async (item: GalleryHistoryItem) => {
    const approved = await confirm({
      title: t.gallery.worksDeleteConfirmTitle,
      message: t.gallery.worksDeleteConfirm,
      confirmLabel: t.gallery.worksDeleteYes,
      cancelLabel: t.gallery.worksDeleteNo,
      tone: "danger",
    });
    if (!approved) return;
    setBusyId(item.id);
    const snapshot = works;
    setWorks((prev) => prev.filter((w) => w.id !== item.id));
    const result = await deleteGalleryHistoryAsync(item.id);
    if (result.ok) {
      setWorks(result.works);
      showToast(t.gallery.worksDeleteDone, "success");
    } else {
      setWorks(snapshot);
      showToast(t.gallery.worksDeleteFailed, "error");
    }
    setBusyId(null);
  };

  const tabs: { id: TabId; label: string; locked?: boolean }[] = [
    { id: "works", label: t.gallery.tabWorks },
    { id: "models", label: t.gallery.tabModels, locked: !canAccessAiModels },
    { id: "photos", label: t.gallery.tabPhotos },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((item) => {
          const locked = Boolean(item.locked);
          const active = tab === item.id && !locked;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => void selectTab(item.id)}
              aria-disabled={locked}
              title={locked ? t.gallery.modelsLockedTitle : undefined}
              className={`min-w-[calc(50%-0.25rem)] flex-1 rounded-lg px-3 py-2.5 text-left text-xs font-medium leading-snug transition-colors sm:min-w-0 sm:px-4 sm:text-sm ${
                locked
                  ? "cursor-not-allowed text-white/30 opacity-55"
                  : active
                    ? "bg-glow-purple/20 text-white shadow-glow-sm"
                    : "text-white/50 hover:text-white/80"
              }`}
            >
              <span className="inline-flex items-start gap-1.5">
                {locked ? (
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                ) : null}
                <span>{item.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {tab === "works" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/85">
            {t.gallery.worksGalleryQuota
              .replace("{used}", String(works.length))
              .replace("{limit}", String(galleryLimit))}
          </div>
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
            <div
              data-gallery-grid="works-wide"
              className="grid w-full grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
            >
              {works.map((item) => {
                const daysLeft = daysUntilExpiry(item.expiresAt);
                const showExpiry = shouldShowExpiryBadge(retentionCtx, item.expiresAt);
                return (
                  <div
                    key={item.id}
                    data-gallery-card="work"
                    className="glass-card flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10"
                  >
                    <div
                      className="relative flex w-full shrink-0 items-center justify-center overflow-hidden"
                      style={{
                        height: 280,
                        minHeight: 280,
                        maxHeight: 280,
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.25) 100%), #0a0c12",
                      }}
                    >
                      <img
                        src={item.thumbnailUrl ?? item.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="pointer-events-none select-none"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          objectPosition: "center",
                        }}
                      />
                      {showExpiry && daysLeft != null && (
                        <div className="absolute top-2 left-2 right-12 z-[1] rounded-lg border border-amber-400/40 bg-amber-500/90 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-black">
                          {t.gallery.expiryBadge.replace("{days}", String(daysLeft))}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleDelete(item)}
                        aria-label={t.gallery.worksDeleteAria}
                        title={t.gallery.worksDeleteAria}
                        className="absolute top-2 right-2 z-[2] inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white/85 shadow-lg backdrop-blur-sm transition-colors hover:border-red-400/50 hover:bg-red-600/80 hover:text-white disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {(item.profileName || item.createdAt) && (
                      <div className="shrink-0 border-b border-white/[0.06] px-3 py-2 text-[11px] text-white/45">
                        {item.profileName ? (
                          <span className="font-medium text-white/70">{item.profileName}</span>
                        ) : null}
                        {item.profileName && item.createdAt ? " · " : null}
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : null}
                      </div>
                    )}
                    <div className="mt-auto shrink-0 space-y-1.5 p-3">
                      <div className="grid w-full grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => handlePortraitFromWork(item)}
                          className="btn-primary inline-flex h-11 min-w-0 items-center justify-center gap-1 px-1.5 text-center text-[11px] font-semibold leading-tight disabled:opacity-50"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0">{t.gallery.worksPortraitFromFace}</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void handleShare(item)}
                          className="btn-secondary inline-flex h-11 min-w-0 items-center justify-center gap-1 px-1.5 text-center text-[11px] font-semibold leading-tight disabled:opacity-50"
                        >
                          <Share2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0">{t.gallery.worksShare}</span>
                        </button>
                      </div>
                      <div className="grid w-full grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === item.id || fhdRemaining < 1}
                          onClick={() => void handleDownload(item, "standard")}
                          className="inline-flex h-11 min-w-0 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-1.5 text-center text-[10px] font-semibold leading-tight text-white disabled:opacity-50 sm:text-[11px]"
                        >
                          <Download className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 [word-break:keep-all]">
                            {standardLabel}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id || uhd4kRemaining < 1}
                          onClick={() => void handleDownload(item, "high")}
                          className="inline-flex h-11 min-w-0 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-500 px-1.5 text-center text-[10px] font-semibold leading-tight text-white disabled:opacity-50 sm:text-[11px]"
                        >
                          <Download className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 [word-break:keep-all]">
                            {highLabel}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "models" && canAccessAiModels && <FaceProfilePanel />}

      {tab === "photos" && <GeneralPhotosPanel />}
    </div>
  );
}
