"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Upload,
  Palette,
  Check,
  ChevronRight,
  ChevronLeft,
  ImagePlus,
  X,
  AlertCircle,
  Sparkles,
  Wand2,
  Download,
  Share2,
  ChevronDown,
  ArrowUpRight,
  RefreshCw,
  Images,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import BrandWatermark from "@/components/BrandWatermark";
import ThumbnailEditor from "@/components/ThumbnailEditor";
import {
  subjectTypeOptions,
  ageOptions,
  stylePacksMeta,
  CONCEPT_GROUP_IDS,
  CONCEPT_GROUP_EMOJI,
  type ConceptGroupId,
  PROMPT_MAX_LENGTH,
  HERO_AFTER_IMAGE,
  MIN_SELFIE_UPLOADS,
  REGENERATE_CREDIT_COST,
  BACKGROUND_TAG_IDS,
  BACKGROUND_MODE_IDS,
  type BackgroundModeId,
} from "@/lib/data";
import {
  pushGalleryHistory,
  listGalleryHistory,
  listFaceProfiles,
  getAccountMeta,
  type FaceProfile,
} from "@/lib/faceProfiles";
import { uploadGalleryAsset } from "@/lib/galleryUpload";
import { retentionContextFromAccount } from "@/lib/retentionPolicy";
import { buildFaceConsistencyPayload } from "@/lib/faceConsistency";
import { apiFetchJson } from "@/lib/apiFetch";
import { processUploadFiles } from "@/lib/processUpload";
import { downloadImageFile, type AspectRatioKey, type ExportPreset } from "@/lib/downloadImage";
import { useFeedback } from "@/components/FeedbackProvider";

type SubjectId = (typeof subjectTypeOptions)[number]["id"];
type ResultView = "compare" | "detail";

const PERSONA_DEFAULTS = {
  subject: "male" as SubjectId,
  age: "30s",
};

const ASPECT_CLASS: Record<AspectRatioKey, string> = {
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
  "1:1": "aspect-square",
  a4: "aspect-[1/1.41]",
};

const ACCEPT_ATTR =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";

export default function PersonaCreator() {
  return (
    <Suspense fallback={<section id="creator" className="section-padding relative" />}>
      <PersonaCreatorInner />
    </Suspense>
  );
}

function PersonaCreatorInner() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const {
    credits,
    maxCredits,
    isFreePlan,
    consumeCredit,
    setShowCreditModal,
    registerPortrait,
    requestRetouch,
    planId,
    refreshAccount,
  } = useCredits();
  const { confirm, showToast } = useFeedback();
  const stepContentRef = useRef<HTMLDivElement>(null);
  const trainingAbortRef = useRef(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [subject, setSubject] = useState<SubjectId>(PERSONA_DEFAULTS.subject);
  const [age, setAge] = useState(PERSONA_DEFAULTS.age);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [conceptGroup, setConceptGroup] = useState<ConceptGroupId | "all">("all");
  const [styleLocked, setStyleLocked] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundModeId>("auto");
  const [backgroundTags, setBackgroundTags] = useState<string[]>([]);
  const [backgroundCustom, setBackgroundCustom] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [focusedDraft, setFocusedDraft] = useState<0 | 1>(0);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [resultReady, setResultReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey>("9:16");
  const [exportPreset, setExportPreset] = useState<ExportPreset>("original");
  const [portraitId, setPortraitId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<FaceProfile[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [gallerySavedMsg, setGallerySavedMsg] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  /** After generation: compare (A/B pick) first, then detail (download/edit). */
  const [resultView, setResultView] = useState<ResultView>("compare");

  const isPerson = subject === "male" || subject === "female";
  const focusedImageUrl = drafts[focusedDraft] ?? HERO_AFTER_IMAGE;

  const goToResultView = useCallback(
    (view: ResultView) => {
      setResultView(view);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", view);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Smart skip: arriving from a "create with this style" card locks the pick and jumps to step 2.
  useEffect(() => {
    const style = searchParams.get("style");
    if (!style) return;
    setSelectedStyles((prev) => (prev.includes(style) ? prev : [...prev, style]));
    setStyleLocked(true);
    setCurrentStep((step) => (step < 2 ? 2 : step));
    setMaxStepReached((step) => (step < 2 ? 2 : step));
  }, [searchParams]);

  useEffect(() => {
    if (currentStep === 3) {
      setSavedProfiles(listFaceProfiles());
    }
  }, [currentStep]);

  const steps = [
    { id: 1, title: t.creator.step1Title, icon: Palette, description: t.creator.step1Desc },
    { id: 2, title: t.creator.step2Title, icon: User, description: t.creator.step2Desc },
    { id: 3, title: t.creator.step3Title, icon: Upload, description: t.creator.step3Desc },
    { id: 4, title: t.creator.step4Title, icon: Wand2, description: t.creator.step4Desc },
  ];

  const conceptTabs = ["all", ...CONCEPT_GROUP_IDS] as const;
  const visiblePacks =
    conceptGroup === "all"
      ? stylePacksMeta
      : stylePacksMeta.filter((pack) => pack.conceptGroup === conceptGroup);

  const subjectLabels: Record<SubjectId, string> = {
    male: t.creator.subjectMale,
    female: t.creator.subjectFemale,
    object: t.creator.subjectObject,
  };

  const ageLabels: Record<string, string> = {
    "10s": t.creator.age10s,
    "20s": t.creator.age20s,
    "30s": t.creator.age30s,
    "40s": t.creator.age40s,
    "50s": t.creator.age50s,
    "60s": t.creator.age60s,
    "70s": t.creator.age70s,
    "80s": t.creator.age80s,
  };

  const backgroundModeLabels: Record<BackgroundModeId, string> = {
    auto: t.creator.bgAuto,
    tags: t.creator.bgTags,
    custom: t.creator.bgCustom,
  };

  /** Chips echoing the step 1-3 choices, shown above the step 4 results. */
  const selectionSummary = (() => {
    const styleNames = selectedStyles
      .map((id) => t.styles.packs[id as keyof typeof t.styles.packs]?.name)
      .filter(Boolean) as string[];

    const backgroundValue =
      backgroundMode === "tags" && backgroundTags.length > 0
        ? backgroundTags.map((tag) => t.creator.bgTagsLabels[tag as keyof typeof t.creator.bgTagsLabels]).join(" · ")
        : backgroundMode === "custom" && backgroundCustom.trim()
          ? backgroundCustom.trim()
          : backgroundModeLabels[backgroundMode];

    return [
      {
        key: "style",
        label: t.creator.summaryStyleLabel,
        value: styleNames.length > 0 ? styleNames.join(" · ") : "—",
      },
      {
        key: "subject",
        label: t.creator.summarySubjectLabel,
        value: isPerson
          ? `${subjectLabels[subject]} · ${ageLabels[age] ?? age}`
          : subjectLabels[subject],
      },
      {
        key: "background",
        label: t.creator.summaryBackgroundLabel,
        value: backgroundValue,
      },
      {
        key: "photos",
        label: t.creator.summaryPhotosLabel,
        value: t.creator.summaryPhotosValue.replace("{count}", String(uploadedFiles.length)),
      },
    ];
  })();

  const goToStep = useCallback((step: number, options?: { scroll?: boolean }) => {
    setCurrentStep(step);
    setMaxStepReached((prev) => (step > prev ? step : prev));
    setValidationError(null);
    if (options?.scroll === false) return;
    requestAnimationFrame(() => {
      stepContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const handleBackStep = useCallback(() => {
    if (isTraining) {
      trainingAbortRef.current = true;
      setIsTraining(false);
      setTrainingProgress(0);
      goToStep(3, { scroll: false });
      return;
    }
    if (currentStep === 4 && resultReady && resultView === "detail") {
      goToResultView("compare");
      return;
    }
    if (currentStep === 4) {
      goToStep(3, { scroll: false });
      return;
    }
    goToStep(Math.max(1, currentStep - 1), { scroll: false });
  }, [currentStep, goToResultView, goToStep, isTraining, resultReady, resultView]);

  const mapUploadErrors = useCallback(
    (errors: string[]) => {
      return errors
        .map((err) => {
          const [code, name = ""] = err.split(":");
          if (code === "unsupported") {
            return t.creator.uploadErrorUnsupported.replace("{name}", name);
          }
          if (code === "tooLarge") {
            return t.creator.uploadErrorTooLarge.replace("{name}", name);
          }
          if (code === "convertFail") {
            return t.creator.uploadErrorConvert.replace("{name}", name);
          }
          return err;
        })
        .join("\n");
    },
    [t]
  );

  const ingestFiles = useCallback(
    async (fileList: File[]) => {
      if (!fileList.length) return;
      setIsUploading(true);
      setValidationError(null);
      try {
        const { ok, errors } = await processUploadFiles(
          fileList,
          10 - uploadedFiles.length
        );
        if (ok.length) {
          setUploadedFiles((prev) => [...prev, ...ok.map((f) => f.url)].slice(0, 10));
        }
        if (errors.length) {
          setValidationError(mapUploadErrors(errors));
        }
      } finally {
        setIsUploading(false);
      }
    },
    [uploadedFiles.length, mapUploadErrors]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      void ingestFiles(Array.from(e.dataTransfer.files));
    },
    [ingestFiles]
  );

  const selectSubject = (id: SubjectId) => {
    setSubject(id);
    setValidationError(null);
    if (id === "object") {
      // Skip age UI and move straight to upload
      goToStep(3);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (selectedStyles.length < 1) {
        setValidationError(t.creator.validationStyleMin);
        return;
      }
      goToStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!subject) {
        setValidationError(
          t.creator.validationMissingFields.replace("{fields}", t.creator.subject)
        );
        return;
      }
      if (isPerson && !age) {
        setValidationError(
          t.creator.validationMissingFields.replace("{fields}", t.creator.age)
        );
        return;
      }
      goToStep(3);
    }
  };

  useEffect(() => {
    if (!isTraining) return;
    setTrainingProgress(0);
    const interval = setInterval(() => {
      setTrainingProgress((p) => (p >= 92 ? 92 : p + 3));
    }, 90);
    return () => clearInterval(interval);
  }, [isTraining]);

  const toggleStyle = (id: string) => {
    setStyleLocked(false);
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setValidationError(null);
  };

  const chooseStyleAndContinue = (id: string) => {
    setSelectedStyles([id]);
    setStyleLocked(true);
    setValidationError(null);
    goToStep(2);
  };

  const focusDraft = (idx: 0 | 1) => {
    setFocusedDraft(idx);
  };

  const toggleBackgroundTag = (tag: string) => {
    setBackgroundTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  /** Runs portrait generation + gallery save. Returns false if blocked (e.g. no credits). */
  const runInitialGeneration = useCallback(async (): Promise<boolean> => {
    if (credits <= 0) {
      setShowCreditModal(true);
      return false;
    }

    setIsGenerating(true);
    setResultReady(false);
    setResultView("compare");
    setGallerySavedMsg(false);
    setActionMessage(null);
    setGenerationError(null);
    const base = `portrait-${Date.now()}`;

    const facePayload = buildFaceConsistencyPayload({
      mode: "initial",
      selfieUrls: uploadedFiles,
      prompt,
      aspectRatio,
      styleIds: selectedStyles,
    });

    let urls: string[] = [];
    let serverDebited = false;
    try {
      const result = await apiFetchJson<{
        imageUrls?: string[];
        error?: string;
        refunded?: boolean;
        ledgerId?: string | null;
        message?: string;
      }>("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facePayload),
      });

      if (result.error === "network" || result.status === 0) {
        console.error("[PersonaCreator] generate network failure", result);
        setGenerationError(t.creator.generateNetworkError);
        showToast(t.creator.generateFailed, "error");
        setIsGenerating(false);
        return false;
      }

      const data = result.data;
      if (result.status === 402) {
        setGenerationError(t.creator.generateFailed);
        showToast(t.creator.generateFailed, "error");
        setShowCreditModal(true);
        setIsGenerating(false);
        return false;
      }
      if (!result.ok || !data?.imageUrls?.length) {
        console.error("[PersonaCreator] generate failed", {
          status: result.status,
          error: result.error,
          serverError: data?.error ?? data?.message,
          preview: result.rawPreview,
        });
        const errMsg = data?.refunded
          ? t.creator.generateFailedRefunded
          : t.creator.generateFailed;
        setGenerationError(errMsg);
        showToast(t.creator.generateFailed, "error");
        if (data?.refunded) await refreshAccount();
        setIsGenerating(false);
        return false;
      }
      urls = data.imageUrls;
      serverDebited = Boolean(data.ledgerId);
      if (serverDebited) await refreshAccount();
    } catch (err) {
      console.error("[PersonaCreator] generate unexpected error", err);
      setGenerationError(t.creator.generateNetworkError);
      showToast(t.creator.generateFailed, "error");
      setIsGenerating(false);
      return false;
    }

    if (!serverDebited && !consumeCredit(1)) {
      setShowCreditModal(true);
      setIsGenerating(false);
      return false;
    }

    registerPortrait(`${base}-0`);
    registerPortrait(`${base}-1`);
    setPortraitId(base);
    const draftA = urls[0];
    const draftB = urls[1] ?? urls[0];
    setDrafts([draftA, draftB]);
    setFocusedDraft(0);
    const styleId = selectedStyles[0];
    const now = Date.now();
    const meta = getAccountMeta();
    const retentionCtx = retentionContextFromAccount(planId, meta);

    const draftsToSave: { id: string; url: string }[] = [
      { id: `${base}-0`, url: draftA },
      { id: `${base}-1`, url: draftB },
    ];

    for (const draft of draftsToSave) {
      const uploaded = await uploadGalleryAsset(draft.url, draft.id, planId);
      pushGalleryHistory(
        {
          id: draft.id,
          imageUrl: uploaded?.thumbnailUrl ?? draft.url,
          thumbnailUrl: uploaded?.thumbnailUrl,
          originalKey: uploaded?.originalKey,
          storageId: uploaded?.storageId ?? draft.id,
          createdAt: draft.id.endsWith("-0") ? now : now + 1,
          styleId,
        },
        retentionCtx
      );
    }

    setIsGenerating(false);
    setResultReady(true);
    setResultView("compare");
    {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "compare");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }
    setGallerySavedMsg(true);
    return true;
  }, [
    aspectRatio,
    consumeCredit,
    credits,
    pathname,
    planId,
    prompt,
    refreshAccount,
    registerPortrait,
    router,
    searchParams,
    selectedStyles,
    setShowCreditModal,
    showToast,
    t.creator.generateFailed,
    t.creator.generateFailedRefunded,
    t.creator.generateNetworkError,
    uploadedFiles,
  ]);

  const handleStartTraining = () => {
    if (selectedStyles.length < 1) {
      setValidationError(t.creator.validationStyleMin);
      return;
    }
    if (uploadedFiles.length < MIN_SELFIE_UPLOADS) {
      setValidationError(t.creator.validationUploadMin);
      return;
    }
    if (credits <= 0) {
      setShowCreditModal(true);
      return;
    }
    setValidationError(null);
    trainingAbortRef.current = false;
    // Jump to step 4 immediately and show the training overlay so step 1/3
    // never flash when generation finishes (avoids concept-gallery flicker).
    setCurrentStep(4);
    setMaxStepReached((prev) => (prev < 4 ? 4 : prev));
    setTrainingProgress(0);
    setIsTraining(true);

    void (async () => {
      const startedAt = Date.now();
      await runInitialGeneration();
      if (trainingAbortRef.current) return;

      const elapsed = Date.now() - startedAt;
      const minMs = 2200;
      if (elapsed < minMs) {
        await new Promise((r) => setTimeout(r, minMs - elapsed));
      }
      if (trainingAbortRef.current) return;

      setTrainingProgress(100);
      setIsTraining(false);
      // Already on step 4 — do not call goToStep (avoids scroll jump / remount flicker).
      requestAnimationFrame(() => {
        stepContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    })();
  };

  const handleGenerate = () => {
    void runInitialGeneration();
  };

  const handleRegenerate = () => {
    if (!portraitId || regenerateBusy) return;
    if (credits < REGENERATE_CREDIT_COST) {
      setShowCreditModal(true);
      return;
    }
    setRegenerateBusy(true);
    setActionMessage(null);
    const id = `${portraitId}-${focusedDraft}`;

    const facePayload = buildFaceConsistencyPayload({
      mode: "regenerate",
      selfieUrls: uploadedFiles,
      draftUrl: drafts[focusedDraft],
      prompt,
      aspectRatio,
      styleIds: selectedStyles,
    });

    void (async () => {
      let nextUrl: string | null = null;
      let serverDebited = false;
      try {
        const result = await apiFetchJson<{
          imageUrls?: string[];
          error?: string;
          refunded?: boolean;
          ledgerId?: string | null;
          message?: string;
        }>("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(facePayload),
        });

        if (result.error === "network" || result.status === 0) {
          console.error("[PersonaCreator] regenerate network failure", result);
          setActionMessage(t.creator.generateNetworkError);
          setRegenerateBusy(false);
          return;
        }

        const data = result.data;
        if (result.status === 402) {
          setShowCreditModal(true);
          setRegenerateBusy(false);
          return;
        }
        if (result.status === 429) {
          setActionMessage(t.creator.retouchThrottle);
          setRegenerateBusy(false);
          return;
        }
        if (!result.ok || !data?.imageUrls?.length) {
          console.error("[PersonaCreator] regenerate failed", {
            status: result.status,
            error: result.error,
            serverError: data?.error ?? data?.message,
            preview: result.rawPreview,
          });
          setActionMessage(
            data?.refunded ? t.creator.generateFailedRefunded : t.creator.generateFailed
          );
          if (data?.refunded) await refreshAccount();
          setRegenerateBusy(false);
          return;
        }
        nextUrl = data.imageUrls[0];
        serverDebited = Boolean(data.ledgerId);
        if (serverDebited) await refreshAccount();
      } catch (err) {
        console.error("[PersonaCreator] regenerate unexpected error", err);
        setActionMessage(t.creator.generateNetworkError);
        setRegenerateBusy(false);
        return;
      }

      if (!serverDebited) {
        const result = requestRetouch(id, "regenerate");
        if (!result.ok) {
          setRegenerateBusy(false);
          if (result.reason === "throttle") setActionMessage(t.creator.retouchThrottle);
          else if (result.reason === "daily_limit") setActionMessage(t.creator.retouchDailyLimit);
          else if (result.reason === "insufficient_credits") setShowCreditModal(true);
          return;
        }
      }

      if (nextUrl) {
        setDrafts((prev) => {
          const next = [...prev];
          next[focusedDraft] = nextUrl as string;
          return next;
        });
      }
      setRegenerateBusy(false);
    })();
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const imageUrl = focusedImageUrl;
    try {
      await downloadImageFile({
        imageUrl,
        filename:
          exportPreset === "id-photo"
            ? `studio-canvas-id-photo-${Date.now()}.png`
            : exportPreset === "print-png"
              ? `studio-canvas-print-a4-300dpi-${Date.now()}.png`
              : exportPreset === "print-pdf"
                ? `studio-canvas-print-a4-300dpi-${Date.now()}.pdf`
                : `studio-canvas-hd-${Date.now()}.png`,
        bakeWatermark: isFreePlan && exportPreset !== "print-png" && exportPreset !== "print-pdf",
        aspectRatio,
        exportPreset,
        printPaper: "a4",
      });
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadDraft = async (draftIdx: 0 | 1) => {
    const imageUrl = drafts[draftIdx];
    if (!imageUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadImageFile({
        imageUrl,
        filename: `studio-canvas-draft-${draftIdx === 0 ? "A" : "B"}-${Date.now()}.png`,
        bakeWatermark: isFreePlan,
        aspectRatio,
        exportPreset: "original",
        printPaper: "a4",
      });
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  };

  // Drafts are auto-saved on generation, so this only fills the gap for re-runs.
  const handleSaveToGallery = () => {
    const existing = listGalleryHistory();
    const missing = drafts.filter((url) => !existing.some((item) => item.imageUrl === url));
    if (missing.length > 0) {
      const retentionCtx = retentionContextFromAccount(planId, getAccountMeta());
      const now = Date.now();
      missing.forEach((url, idx) => {
        const id = `${portraitId ?? "draft"}-save-${now}-${idx}`;
        pushGalleryHistory(
          {
            id,
            imageUrl: url,
            storageId: id,
            createdAt: now + idx,
            styleId: selectedStyles[0],
          },
          retentionCtx
        );
      });
    }
    setGallerySavedMsg(true);
  };

  const handleRetryWithAnotherStyle = () => {
    setResultReady(false);
    setResultView("compare");
    setDrafts([]);
    setGallerySavedMsg(false);
    setGenerationError(null);
    setStyleLocked(false);
    goToStep(1);
  };

  const handleDeletePortrait = async () => {
    const approved = await confirm({
      title: t.creator.deletePortraitConfirmTitle,
      message: t.creator.deletePortraitConfirm,
      confirmLabel: t.creator.deleteConfirmYes,
      cancelLabel: t.creator.deleteConfirmNo,
      tone: "danger",
    });
    if (!approved) return;
    setResultReady(false);
    setResultView("compare");
    setDrafts([]);
    setPortraitId(null);
    setGallerySavedMsg(false);
    setActionMessage(null);
    showToast(t.creator.deletePortraitDone, "success");
  };

  const handleShare = async () => {
    const imageUrl = focusedImageUrl;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], `studio-canvas-${Date.now()}.png`, { type: blob.type });
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
    }
  };

  const loadSavedProfile = (profile: FaceProfile) => {
    setSelectedProfileId(profile.id);
    setUploadedFiles(profile.photoUrls.slice(0, 10));
    setValidationError(null);
    setProfileMenuOpen(false);
  };

  const uploadStepTitle = isPerson ? t.creator.uploadTitlePerson : t.creator.uploadTitleObject;

  return (
    <section id="creator" className="section-padding relative">
      <div className="ambient-glow top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 bg-glow-purple/10" />

      <div className="relative mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <span className="text-sm font-medium tracking-widest text-glow-purple uppercase">
            {t.creator.eyebrow}
          </span>
          <h2 className="font-display mt-3 text-3xl font-bold sm:text-4xl">{t.creator.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/50">{t.creator.subtitle}</p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-1 overflow-x-auto sm:gap-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;

            const canNavigate =
              !isTraining && step.id <= maxStepReached && step.id !== currentStep;

            return (
              <div key={step.id} className="flex items-center gap-1 sm:gap-3">
                <button
                  type="button"
                  onClick={() => canNavigate && goToStep(step.id)}
                  disabled={!canNavigate}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`${step.id}. ${step.title}`}
                  className={`flex flex-col items-center gap-2 rounded-xl transition-opacity ${
                    canNavigate ? "cursor-pointer hover:opacity-80" : "cursor-default"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-500 sm:h-12 sm:w-12 ${
                      isActive
                        ? "border-glow-purple/50 bg-glow-purple/20 shadow-glow-sm"
                        : isComplete
                          ? "border-glow-emerald/50 bg-glow-emerald/20"
                          : "border-white/25 bg-white/10"
                    }`}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4 text-glow-emerald sm:h-5 sm:w-5" />
                    ) : (
                      <Icon
                        className={`h-4 w-4 sm:h-5 sm:w-5 ${isActive ? "text-glow-purple" : "text-zinc-200"}`}
                      />
                    )}
                  </div>
                  <div className="hidden max-w-[5rem] text-center sm:block sm:max-w-none">
                    <div
                      className={`text-xs font-semibold leading-tight ${isActive ? "text-white" : "text-zinc-200"}`}
                    >
                      {step.title}
                    </div>
                    <div className="text-[10px] leading-tight text-white/80">{step.description}</div>
                  </div>
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className={`mb-6 h-px w-3 sm:w-10 ${isComplete ? "bg-glow-emerald/50" : "bg-white/25"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {(isTraining || currentStep >= 3) && (
          <div className="sticky top-16 z-40 mb-4 sm:top-[4.5rem]">
            <button
              type="button"
              onClick={handleBackStep}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-navy/90 px-3.5 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-md transition-colors hover:border-white/35 hover:bg-white/10"
              aria-label={t.creator.backStep}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span>{t.creator.backStep.replace(/^←\s*/, "")}</span>
            </button>
          </div>
        )}

        <div ref={stepContentRef} className="glass-card p-4 sm:p-8">
          {isTraining && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-6 h-24 w-24">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-glow-purple/30 border-t-glow-purple" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-glow-purple" />
                </div>
              </div>
              <p className="mb-4 text-sm font-medium text-white/80">{t.creator.trainingProgress}</p>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-glow-purple to-glow-emerald transition-all duration-200"
                  style={{ width: `${trainingProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-white/40">{Math.round(trainingProgress)}%</p>
            </div>
          )}

          {!isTraining && currentStep === 1 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <h3 className="font-display text-xl font-bold sm:text-2xl">
                  {t.creator.conceptTitle}
                </h3>
                <p className="mx-auto mt-2 max-w-lg text-sm text-white/50">
                  {t.creator.conceptSubtitle}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {conceptTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setConceptGroup(tab)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                      conceptGroup === tab
                        ? "border-glow-purple/50 bg-glow-purple/15 text-white"
                        : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/80"
                    }`}
                  >
                    {tab === "all"
                      ? t.creator.conceptGroups.all
                      : `${CONCEPT_GROUP_EMOJI[tab]} ${t.creator.conceptGroups[tab]}`}
                  </button>
                ))}
              </div>

              {conceptGroup !== "all" && (
                <p className="text-center text-xs leading-relaxed text-glow-emerald/80 sm:text-sm">
                  ( {t.creator.conceptGroupHints[conceptGroup]} )
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visiblePacks.map((pack) => {
                  const meta = t.styles.packs[pack.id as keyof typeof t.styles.packs];
                  if (!meta) return null;
                  const isSelected = selectedStyles.includes(pack.id);
                  return (
                    <div
                      key={pack.id}
                      className={`group flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 ${
                        isSelected
                          ? "border-glow-emerald/50 bg-glow-emerald/10 shadow-glow-sm"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleStyle(pack.id)}
                        className="relative aspect-[4/5] w-full overflow-hidden"
                      >
                        <img
                          src={pack.imageUrl}
                          alt={meta.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className={`absolute inset-0 bg-gradient-to-t ${pack.gradient}`} />
                        <span className="absolute top-3 left-3 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                          {`${CONCEPT_GROUP_EMOJI[pack.conceptGroup]} ${meta.badge ?? t.creator.conceptGroups[pack.conceptGroup]}`}
                        </span>
                        {isSelected && (
                          <span className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-glow-emerald text-navy">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </button>

                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{meta.name}</h4>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-100 font-medium">
                            {meta.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-violet-400/50 bg-violet-950/60 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                            {t.creator.compositionTags[pack.composition]}
                          </span>
                          {meta.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                            >
                              {`#${tag}`}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => chooseStyleAndContinue(pack.id)}
                          className="btn-primary mt-auto w-full justify-center py-2.5 text-sm font-bold text-white shadow-md"
                        >
                          <span className="truncate">{t.creator.makeWithStyle}</span>
                          <ArrowUpRight className="h-4 w-4 shrink-0" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isTraining && currentStep === 2 && (
            <div className="animate-fade-in space-y-8">
              {styleLocked && (
                <p className="rounded-xl border border-glow-emerald/20 bg-glow-emerald/10 px-4 py-3 text-xs text-emerald-100/90 sm:text-sm">
                  {t.creator.styleLocked}
                </p>
              )}

              <div>
                <h3 className="mb-4 text-sm font-medium tracking-wider text-white/60 uppercase">
                  {t.creator.subject}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {subjectTypeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectSubject(option.id)}
                      className={`rounded-xl border p-4 text-center transition-all duration-300 ${
                        subject === option.id
                          ? "border-glow-purple/50 bg-glow-purple/10 shadow-glow-sm"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="mb-2 text-2xl">{option.icon}</div>
                      <div className="text-xs font-medium leading-snug sm:text-sm">
                        {subjectLabels[option.id]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {isPerson && (
                <div className="animate-fade-in">
                  <h3 className="mb-3 text-sm font-medium tracking-wider text-white/60 uppercase">
                    {t.creator.age}
                  </h3>
                  <p className="mb-3 text-xs leading-relaxed text-white/45 sm:text-sm">
                    {t.creator.ageHint}
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {ageOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setAge(option.id);
                          setValidationError(null);
                        }}
                        className={`rounded-xl border p-3 text-center transition-all duration-300 sm:p-4 ${
                          age === option.id
                            ? "border-glow-purple/50 bg-glow-purple/10 shadow-glow-sm"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
                        }`}
                      >
                        <div className="mb-1 text-xl sm:mb-2 sm:text-2xl">{option.icon}</div>
                        <div className="text-xs font-medium leading-tight sm:text-sm">
                          {ageLabels[option.id]}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isTraining && currentStep === 3 && (
            <div className="animate-fade-in space-y-6">
              <h3 className="text-base font-semibold text-white/90 sm:text-lg">
                {uploadStepTitle}
              </h3>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((o) => !o)}
                  className="btn-secondary flex w-full items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <span>{t.creator.loadSavedPhotos}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {profileMenuOpen && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-navy/95 shadow-xl backdrop-blur-xl">
                    {savedProfiles.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-white/45">
                        {t.creator.loadSavedPhotosEmpty}
                      </p>
                    ) : (
                      savedProfiles.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => loadSavedProfile(profile)}
                          className={`flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-white/5 ${
                            selectedProfileId === profile.id ? "bg-glow-purple/10 text-white" : "text-white/70"
                          }`}
                        >
                          {profile.photoUrls[0] ? (
                            <img
                              src={profile.photoUrls[0]}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 shrink-0 rounded-lg bg-white/10" />
                          )}
                          <span className="truncate">{profile.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div
                className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-all duration-300 sm:p-8 ${
                  isDragOver
                    ? "border-glow-purple/50 bg-glow-purple/5"
                    : "border-white/15 bg-white/[0.02]"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
              >
                <ImagePlus className="mx-auto mb-4 h-10 w-10 text-white/30" />
                <p className="mb-1 text-sm font-medium text-white/70">{uploadStepTitle}</p>
                <p className="text-xs leading-relaxed text-white/40">{t.creator.uploadHint}</p>
                {isUploading && (
                  <p className="mt-3 text-xs text-glow-purple">{t.creator.uploadProcessing}</p>
                )}
                <input
                  type="file"
                  multiple
                  accept={ACCEPT_ATTR}
                  disabled={isUploading}
                  className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
                  onChange={(e) => {
                    void ingestFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
              </div>

              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/55 sm:text-sm">
                {t.creator.uploadFormatHint}
              </p>

              {isPerson && (
                <p className="rounded-xl border border-glow-emerald/20 bg-glow-emerald/10 px-4 py-3 text-xs leading-relaxed text-emerald-100/90 sm:text-sm">
                  {t.creator.uploadIdentityHint}
                </p>
              )}

              <div className="flex items-center gap-3">
                <span className="shrink-0 text-xs text-white/50 sm:text-sm">
                  {t.creator.uploadCount.replace("{count}", String(uploadedFiles.length))}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-glow-purple to-glow-emerald transition-all duration-500"
                    style={{ width: `${(uploadedFiles.length / 10) * 100}%` }}
                  />
                </div>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {uploadedFiles.map((url, idx) => (
                    <div
                      key={idx}
                      className="group relative aspect-square overflow-hidden rounded-lg"
                    >
                      <img src={url} alt={`${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
                          setValidationError(null);
                        }}
                        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 10 - uploadedFiles.length) }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02]"
                    >
                      <span className="text-xs text-white/20">
                        {uploadedFiles.length + idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-white/[0.06] pt-6">
                <p className="mb-3 text-sm font-medium tracking-wider text-white/60 uppercase">
                  {t.creator.bgModeLabel}
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {BACKGROUND_MODE_IDS.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBackgroundMode(mode)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        backgroundMode === mode
                          ? "border-glow-purple/50 bg-glow-purple/15 font-semibold text-white"
                          : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/70"
                      }`}
                    >
                      {backgroundMode === mode && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-glow-purple" />
                      )}
                      {mode === "auto"
                        ? t.creator.bgAuto
                        : mode === "tags"
                          ? t.creator.bgTags
                          : t.creator.bgCustom}
                    </button>
                  ))}
                </div>

                {backgroundMode === "tags" && (
                  <div className="flex flex-wrap gap-2">
                    {BACKGROUND_TAG_IDS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleBackgroundTag(tag)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          backgroundTags.includes(tag)
                            ? "border-glow-emerald/50 bg-glow-emerald/10 text-white"
                            : "border-white/10 text-white/45 hover:border-white/20"
                        }`}
                      >
                        {t.creator.bgTagsLabels[tag]}
                      </button>
                    ))}
                  </div>
                )}

                {backgroundMode === "custom" && (
                  <input
                    type="text"
                    value={backgroundCustom}
                    onChange={(e) => setBackgroundCustom(e.target.value)}
                    placeholder={t.creator.bgCustomPlaceholder}
                    className="w-full rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-300 focus:border-glow-purple/40"
                  />
                )}
              </div>
            </div>
          )}

          {!isTraining && currentStep === 4 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
                  {resultReady && resultView === "detail"
                    ? t.creator.detailPhaseTitle
                    : resultReady
                      ? t.creator.comparePhaseTitle
                      : t.creator.resultTitle}
                </h3>
                <p className="mt-1 text-sm text-zinc-200">
                  {resultReady && resultView === "detail"
                    ? t.creator.detailPhaseSubtitle
                    : resultReady
                      ? t.creator.comparePhaseSubtitle
                      : t.creator.resultSubtitle}
                </p>
              </div>

              <div className="glass-card p-4">
                <p className="mb-3 text-[11px] font-semibold tracking-wider text-zinc-300 uppercase">
                  {t.creator.summaryTitle}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectionSummary.map((chip) => (
                    <span
                      key={chip.key}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.07] px-3 py-1.5 text-xs backdrop-blur-md"
                    >
                      <span className="shrink-0 text-zinc-300">{chip.label}</span>
                      <span className="truncate font-semibold text-white">{chip.value}</span>
                    </span>
                  ))}
                </div>
              </div>

              {generationError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/40 bg-red-950/50 p-4 text-center"
                >
                  <p className="text-sm font-semibold text-red-200">{generationError}</p>
                  <p className="mt-1 text-xs text-red-200/80">{t.creator.generateRetryHint}</p>
                  <button
                    type="button"
                    onClick={() => void runInitialGeneration()}
                    disabled={isGenerating}
                    className="btn-primary mt-3 inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4 shrink-0" />
                    <span>{t.creator.generateRetry}</span>
                  </button>
                </div>
              )}

              {!resultReady && !isGenerating && !generationError && (
                <div
                  className={`relative mx-auto flex w-full max-w-sm flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center ${ASPECT_CLASS[aspectRatio]}`}
                >
                  <Wand2 className="mb-3 h-8 w-8 text-white/30" />
                  <p className="text-sm text-white/40">{t.creator.promptPreviewLabel}</p>
                </div>
              )}

              {isGenerating && (
                <div
                  className={`relative mx-auto flex w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-white/10 ${ASPECT_CLASS[aspectRatio]}`}
                >
                  <img
                    src={HERO_AFTER_IMAGE}
                    alt=""
                    className="h-full w-full object-cover object-[30%_35%] opacity-40 blur-sm"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-glow-purple/30 border-t-glow-purple" />
                  </div>
                </div>
              )}

              {/* /compare — pick a draft before download/detail */}
              {resultReady && resultView === "compare" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {drafts.map((url, idx) => {
                      const draftIdx = idx as 0 | 1;
                      const isFocused = focusedDraft === draftIdx;
                      return (
                        <div key={`${url}-${idx}`} className="flex min-w-0 flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => focusDraft(draftIdx)}
                            title={t.creator.focusDraft}
                            className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${ASPECT_CLASS[aspectRatio]} ${
                              isFocused
                                ? "border-glow-purple shadow-[0_0_24px_rgba(139,92,246,0.35)]"
                                : "border-white/10 hover:border-white/25"
                            }`}
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover object-[30%_35%]"
                            />
                            <div className="absolute top-2 left-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
                              {draftIdx === 0 ? t.creator.draftA : t.creator.draftB}
                            </div>
                            {isFocused && (
                              <>
                                <div className="absolute top-2 right-2 rounded-md bg-glow-purple/90 px-2 py-1 text-[10px] font-semibold text-white">
                                  [{t.creator.draftSelected}]
                                </div>
                                <BrandWatermark visible={isFreePlan} />
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadDraft(draftIdx)}
                            disabled={isDownloading}
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 px-2 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(139,92,246,0.35)] transition hover:brightness-110 disabled:opacity-50 sm:gap-2 sm:text-sm"
                          >
                            <Download className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                            <span className="truncate">
                              {isDownloading ? "..." : t.creator.draftDownload}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {gallerySavedMsg && (
                    <p className="text-center text-xs text-glow-emerald">{t.creator.savedToGallery}</p>
                  )}

                  <button
                    type="button"
                    onClick={() => goToResultView("detail")}
                    className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-bold"
                  >
                    <Check className="h-4 w-4 shrink-0" />
                    <span>
                      {t.creator.confirmDraftSelect.replace(
                        "{draft}",
                        focusedDraft === 0 ? t.creator.draftA : t.creator.draftB
                      )}
                    </span>
                  </button>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-sm font-medium text-white/70">{t.creator.promptLabel}</label>
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
                        {t.creator.creditBadge
                          .replace("{current}", String(credits))
                          .replace("{max}", String(maxCredits))}
                      </span>
                    </div>
                    <textarea
                      value={prompt}
                      maxLength={PROMPT_MAX_LENGTH}
                      onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX_LENGTH))}
                      placeholder={t.creator.promptPlaceholder}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-300 focus:border-glow-purple/40"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={isGenerating || regenerateBusy}
                    className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold shadow-[0_0_28px_rgba(139,92,246,0.4)] disabled:opacity-50"
                  >
                    <Wand2
                      className={`h-4 w-4 shrink-0 ${regenerateBusy || isGenerating ? "animate-pulse" : ""}`}
                    />
                    <span>
                      {credits >= REGENERATE_CREDIT_COST
                        ? t.creator.regenerateWithCredit
                        : t.creator.regenerateNeedCredit}
                    </span>
                  </button>
                  {actionMessage && (
                    <p className="text-center text-xs text-glow-emerald">{actionMessage}</p>
                  )}
                </div>
              )}

              {/* /detail — download & edit only after draft confirmed */}
              {resultReady && resultView === "detail" && (
                <div className="space-y-4">
                  <div
                    className={`relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-glow-purple/40 shadow-[0_0_24px_rgba(139,92,246,0.25)] ${ASPECT_CLASS[aspectRatio]}`}
                  >
                    <img
                      src={focusedImageUrl}
                      alt=""
                      className="h-full w-full object-cover object-[30%_35%]"
                    />
                    <div className="absolute top-2 left-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
                      {focusedDraft === 0 ? t.creator.draftA : t.creator.draftB}
                    </div>
                    <BrandWatermark visible={isFreePlan} />
                  </div>

                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <button
                      type="button"
                      onClick={() => void handleDownload()}
                      disabled={isDownloading}
                      className="btn-primary flex items-center justify-center gap-2 py-2.5 text-sm font-bold disabled:opacity-50"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      <span>{isDownloading ? "..." : t.creator.actionDownloadHd}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveToGallery}
                      className="btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm"
                    >
                      <Images className="h-4 w-4 shrink-0" />
                      <span>{t.creator.actionSaveGallery}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRetryWithAnotherStyle}
                      className="btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm"
                    >
                      <RefreshCw className="h-4 w-4 shrink-0" />
                      <span>{t.creator.actionRetryStyle}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare()}
                      className="btn-secondary flex items-center justify-center gap-2 py-2.5 text-xs"
                    >
                      <Share2 className="h-4 w-4 shrink-0" />
                      <span>{t.creator.resultShare}</span>
                    </button>
                  </div>
                  <p className="text-center">
                    <Link
                      href="/gallery/my"
                      className="text-xs text-white/80 underline underline-offset-2 hover:text-white"
                    >
                      {t.creator.viewMyGallery}
                    </Link>
                  </p>

                  <div className="space-y-4 border-t border-white/[0.06] pt-4">
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["original", t.creator.exportOriginal],
                          ["id-photo", t.creator.exportIdPhoto],
                          ["print-png", t.creator.exportPrintPng],
                          ["print-pdf", t.creator.exportPrintPdf],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          disabled={isDownloading}
                          onClick={() => {
                            setExportPreset(key);
                            void (async () => {
                              if (isDownloading) return;
                              setIsDownloading(true);
                              const imageUrl = focusedImageUrl;
                              try {
                                await downloadImageFile({
                                  imageUrl,
                                  filename:
                                    key === "id-photo"
                                      ? `studio-canvas-id-photo-${Date.now()}.png`
                                      : key === "print-png"
                                        ? `studio-canvas-print-a4-300dpi-${Date.now()}.png`
                                        : key === "print-pdf"
                                          ? `studio-canvas-print-a4-300dpi-${Date.now()}.pdf`
                                          : `studio-canvas-hd-${Date.now()}.png`,
                                  bakeWatermark:
                                    isFreePlan && key !== "print-png" && key !== "print-pdf",
                                  aspectRatio,
                                  exportPreset: key,
                                  printPaper: "a4",
                                });
                              } catch {
                                window.open(imageUrl, "_blank", "noopener,noreferrer");
                              } finally {
                                setIsDownloading(false);
                              }
                            })();
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                            exportPreset === key
                              ? "border-glow-purple/50 bg-glow-purple/15 text-white"
                              : "border-white/10 text-white/45 hover:border-white/20"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeletePortrait()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 py-3 text-sm text-red-200 transition hover:bg-red-500/20"
                    >
                      <span>{t.creator.deletePortrait}</span>
                    </button>

                    <ThumbnailEditor imageUrl={focusedImageUrl} aspectRatio={aspectRatio} />
                  </div>
                </div>
              )}

              {!resultReady && (
                <>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-sm font-medium text-white/70">{t.creator.promptLabel}</label>
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
                        {t.creator.creditBadge
                          .replace("{current}", String(credits))
                          .replace("{max}", String(maxCredits))}
                      </span>
                    </div>
                    <textarea
                      value={prompt}
                      maxLength={PROMPT_MAX_LENGTH}
                      onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX_LENGTH))}
                      placeholder={t.creator.promptPlaceholder}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-300 focus:border-glow-purple/40"
                    />
                    <div className="mt-1 text-right text-[11px] text-white/30">
                      {prompt.length}/{PROMPT_MAX_LENGTH}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-white/70">{t.creator.aspectRatioLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["9:16", t.creator.aspect916],
                          ["16:9", t.creator.aspect169],
                          ["1:1", t.creator.aspect11],
                          ["a4", t.creator.aspectA4],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAspectRatio(key)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            aspectRatio === key
                              ? "border-glow-purple/50 bg-glow-purple/15 text-white"
                              : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/70"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || regenerateBusy}
                    className="btn-primary w-full py-3 text-sm disabled:opacity-50"
                  >
                    <Wand2 className={`h-4 w-4 shrink-0 ${regenerateBusy || isGenerating ? "animate-pulse" : ""}`} />
                    <span>{t.creator.generatePortrait}</span>
                  </button>

                  {actionMessage && (
                    <p className="text-center text-xs text-glow-emerald">{actionMessage}</p>
                  )}
                </>
              )}
            </div>
          )}

          {validationError && !isTraining && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm whitespace-pre-line text-amber-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {!isTraining && currentStep < 4 && (
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-6">
              <button
                type="button"
                onClick={() => goToStep(Math.max(1, currentStep - 1))}
                className={`btn-secondary min-w-0 px-4 py-2.5 text-sm ${currentStep === 1 ? "invisible" : ""}`}
              >
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.creator.prev}</span>
              </button>

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="btn-primary min-w-0 px-4 py-2.5 text-sm"
                >
                  <span className="truncate">{t.creator.next}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartTraining}
                  className="btn-primary min-w-0 px-4 py-2.5 text-sm"
                >
                  <span className="truncate">{t.creator.startTraining}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              )}
            </div>
          )}

          {!isTraining && currentStep === 4 && (
            <div className="mt-6 flex justify-start border-t border-white/[0.06] pt-6">
              <button
                type="button"
                onClick={handleBackStep}
                className="btn-secondary min-w-0 px-4 py-2.5 text-sm"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.creator.prev}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
