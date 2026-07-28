"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import BrandWatermark from "@/components/BrandWatermark";
import ThumbnailEditor from "@/components/ThumbnailEditor";
import FaceProfilePanel from "@/components/FaceProfilePanel";
import {
  subjectTypeOptions,
  ageOptions,
  wizardStylePackIds,
  PROMPT_MAX_LENGTH,
  HERO_AFTER_IMAGE,
  HERO_BEFORE_IMAGE,
  MIN_SELFIE_UPLOADS,
  RETOUCH_FREE_PER_CYCLE,
  CONCEPT_POSE_HINTS,
  BACKGROUND_TAG_IDS,
  BACKGROUND_MODE_IDS,
  type BackgroundModeId,
} from "@/lib/data";
import { pushGalleryHistory } from "@/lib/faceProfiles";
import { processUploadFiles } from "@/lib/processUpload";
import { downloadImageFile, type AspectRatioKey, type ExportPreset } from "@/lib/downloadImage";

type SubjectId = (typeof subjectTypeOptions)[number]["id"];

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
  const {
    credits,
    maxCredits,
    isFreePlan,
    consumeCredit,
    setShowCreditModal,
    registerPortrait,
    requestRetouch,
    getPortraitRetouch,
  } = useCredits();
  const stepContentRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [subject, setSubject] = useState<SubjectId>(PERSONA_DEFAULTS.subject);
  const [age, setAge] = useState(PERSONA_DEFAULTS.age);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
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
  const [retouchPrompt, setRetouchPrompt] = useState("");
  const [isRetouching, setIsRetouching] = useState(false);
  const [retouchMessage, setRetouchMessage] = useState<string | null>(null);
  const [freeRetouchesLeft, setFreeRetouchesLeft] = useState(RETOUCH_FREE_PER_CYCLE);

  const isPerson = subject === "male" || subject === "female";
  const focusedImageUrl = drafts[focusedDraft] ?? HERO_AFTER_IMAGE;
  const poseHint =
    selectedStyles.length > 0 ? CONCEPT_POSE_HINTS[selectedStyles[0]] : undefined;

  useEffect(() => {
    const style = searchParams.get("style");
    if (!style) return;
    setSelectedStyles((prev) => (prev.includes(style) ? prev : [...prev, style]));
    setCurrentStep((step) => (step < 3 ? 3 : step));
  }, [searchParams]);

  const steps = [
    { id: 1, title: t.creator.step1Title, icon: User, description: t.creator.step1Desc },
    { id: 2, title: t.creator.step2Title, icon: Upload, description: t.creator.step2Desc },
    { id: 3, title: t.creator.step3Title, icon: Palette, description: t.creator.step3Desc },
    { id: 4, title: t.creator.step4Title, icon: Wand2, description: t.creator.step4Desc },
  ];

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

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    setValidationError(null);
    requestAnimationFrame(() => {
      stepContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

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
      requestAnimationFrame(() => goToStep(2));
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
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
      goToStep(2);
      return;
    }

    if (currentStep === 2) {
      if (uploadedFiles.length < MIN_SELFIE_UPLOADS) {
        setValidationError(t.creator.validationUploadMin);
        return;
      }
      goToStep(3);
    }
  };

  useEffect(() => {
    if (!isTraining) return;
    setTrainingProgress(0);
    const interval = setInterval(() => {
      setTrainingProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 4;
      });
    }, 80);
    const done = setTimeout(() => {
      setIsTraining(false);
      setTrainingProgress(100);
      goToStep(4);
    }, 2800);
    return () => {
      clearInterval(interval);
      clearTimeout(done);
    };
  }, [isTraining, goToStep]);

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setValidationError(null);
  };

  const handleStartTraining = () => {
    if (selectedStyles.length < 1) {
      setValidationError(t.creator.validationStyleMin);
      return;
    }
    setValidationError(null);
    setIsTraining(true);
  };

  const focusDraft = (idx: 0 | 1) => {
    setFocusedDraft(idx);
    if (!portraitId) return;
    const state = getPortraitRetouch(`${portraitId}-${idx}`);
    if (state) setFreeRetouchesLeft(state.freeRemaining);
  };

  const toggleBackgroundTag = (tag: string) => {
    setBackgroundTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleGenerate = () => {
    if (credits <= 0) {
      setShowCreditModal(true);
      return;
    }
    if (!consumeCredit(1)) return;
    setIsGenerating(true);
    setResultReady(false);
    setRetouchMessage(null);
    setRetouchPrompt("");
    const base = `portrait-${Date.now()}`;
    setTimeout(() => {
      const state0 = registerPortrait(`${base}-0`);
      registerPortrait(`${base}-1`);
      setPortraitId(base);
      setDrafts([HERO_AFTER_IMAGE, HERO_BEFORE_IMAGE]);
      setFocusedDraft(0);
      setFreeRetouchesLeft(state0.freeRemaining);
      const styleId = selectedStyles[0];
      const now = Date.now();
      pushGalleryHistory({
        id: `${base}-0`,
        imageUrl: HERO_AFTER_IMAGE,
        createdAt: now,
        styleId,
      });
      pushGalleryHistory({
        id: `${base}-1`,
        imageUrl: HERO_BEFORE_IMAGE,
        createdAt: now + 1,
        styleId,
      });
      setIsGenerating(false);
      setResultReady(true);
    }, 1800);
  };

  const handleRegenerate = () => {
    if (!portraitId || regenerateBusy) return;
    setRegenerateBusy(true);
    setRetouchMessage(null);
    const id = `${portraitId}-${focusedDraft}`;
    const result = requestRetouch(id, "regenerate");
    if (!result.ok) {
      setRegenerateBusy(false);
      if (result.reason === "throttle") setRetouchMessage(t.creator.retouchThrottle);
      else if (result.reason === "daily_limit") setRetouchMessage(t.creator.retouchDailyLimit);
      else if (result.reason === "insufficient_credits") setShowCreditModal(true);
      return;
    }

    setTimeout(() => {
      setFreeRetouchesLeft(result.freeRemaining);
      setDrafts((prev) => {
        const next = [...prev];
        const alt = focusedDraft === 0 ? HERO_BEFORE_IMAGE : HERO_AFTER_IMAGE;
        const primary = focusedDraft === 0 ? HERO_AFTER_IMAGE : HERO_BEFORE_IMAGE;
        const current = (next[focusedDraft] ?? primary).split("?")[0];
        next[focusedDraft] =
          current === primary ? `${alt}?t=${Date.now()}` : `${primary}?t=${Date.now()}`;
        return next;
      });
      setRegenerateBusy(false);
    }, 900);
  };

  const handleRetouch = () => {
    if (!portraitId || !retouchPrompt.trim() || isRetouching) return;
    setIsRetouching(true);
    setRetouchMessage(null);

    const id = `${portraitId}-${focusedDraft}`;
    const result = requestRetouch(id, "retouch");
    if (!result.ok) {
      setIsRetouching(false);
      if (result.reason === "throttle") setRetouchMessage(t.creator.retouchThrottle);
      else if (result.reason === "daily_limit") setRetouchMessage(t.creator.retouchDailyLimit);
      else if (result.reason === "insufficient_credits") setShowCreditModal(true);
      return;
    }

    setTimeout(() => {
      setFreeRetouchesLeft(result.freeRemaining);
      setRetouchMessage(t.creator.retouchSuccess);
      setRetouchPrompt("");
      setIsRetouching(false);
    }, 900);
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

        <div className="mb-10 flex items-center justify-center gap-1 overflow-x-auto sm:gap-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;

            return (
              <div key={step.id} className="flex items-center gap-1 sm:gap-3">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-500 sm:h-12 sm:w-12 ${
                      isActive
                        ? "border-glow-purple/50 bg-glow-purple/20 shadow-glow-sm"
                        : isComplete
                          ? "border-glow-emerald/50 bg-glow-emerald/20"
                          : "border-white/10 bg-white/5"
                    }`}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4 text-glow-emerald sm:h-5 sm:w-5" />
                    ) : (
                      <Icon
                        className={`h-4 w-4 sm:h-5 sm:w-5 ${isActive ? "text-glow-purple" : "text-white/40"}`}
                      />
                    )}
                  </div>
                  <div className="hidden max-w-[5rem] text-center sm:block sm:max-w-none">
                    <div
                      className={`text-xs font-medium leading-tight ${isActive ? "text-white" : "text-white/40"}`}
                    >
                      {step.title}
                    </div>
                    <div className="text-[10px] leading-tight text-white/30">{step.description}</div>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`mb-6 h-px w-3 sm:w-10 ${isComplete ? "bg-glow-emerald/50" : "bg-white/10"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div ref={stepContentRef} className="glass-card p-4 sm:p-8">
          {isTraining && (
            <div className="animate-fade-in flex flex-col items-center justify-center py-16 text-center">
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
            <div className="animate-fade-in space-y-8">
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

          {!isTraining && currentStep === 2 && (
            <div className="animate-fade-in space-y-6">
              <FaceProfilePanel
                compact
                selectedId={selectedProfileId}
                onSelect={(profile) => {
                  setSelectedProfileId(profile.id);
                  setUploadedFiles(profile.photoUrls.slice(0, 10));
                  setValidationError(null);
                }}
              />

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
                <p className="mb-1 text-sm font-medium text-white/70">{t.creator.uploadTitle}</p>
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
            </div>
          )}

          {!isTraining && currentStep === 3 && (
            <div className="animate-fade-in space-y-6">
              <p className="text-sm text-white/50">{t.creator.styleSelectHint}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {wizardStylePackIds.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => toggleStyle(pack.id)}
                    className={`rounded-xl border p-4 text-center transition-all duration-300 sm:p-5 ${
                      selectedStyles.includes(pack.id)
                        ? "border-glow-emerald/50 bg-glow-emerald/10 shadow-glow-sm"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="mb-2 text-2xl sm:text-3xl">{pack.emoji}</div>
                    <div className="text-xs font-medium leading-tight sm:text-sm">
                      {t.creator.styles[pack.id]}
                    </div>
                    {selectedStyles.includes(pack.id) && (
                      <Check className="mx-auto mt-2 h-4 w-4 text-glow-emerald" />
                    )}
                  </button>
                ))}
              </div>

              {poseHint && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="mb-1 text-xs font-medium tracking-wider text-white/50 uppercase">
                    {t.creator.poseHintLabel}
                  </p>
                  <p className="text-sm text-white/70">{poseHint}</p>
                </div>
              )}

              <div>
                <p className="mb-3 text-sm font-medium tracking-wider text-white/60 uppercase">
                  {t.creator.bgModeLabel}
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {BACKGROUND_MODE_IDS.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBackgroundMode(mode)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        backgroundMode === mode
                          ? "border-glow-purple/50 bg-glow-purple/15 text-white"
                          : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/70"
                      }`}
                    >
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
                        className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${
                          backgroundTags.includes(tag)
                            ? "border-glow-emerald/50 bg-glow-emerald/10 text-white"
                            : "border-white/10 text-white/45 hover:border-white/20"
                        }`}
                      >
                        {tag}
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
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-glow-purple/40"
                  />
                )}
              </div>
            </div>
          )}

          {!isTraining && currentStep === 4 && (
            <div className="animate-fade-in space-y-6">
              <FaceProfilePanel
                compact
                selectedId={selectedProfileId}
                onSelect={(profile) => {
                  setSelectedProfileId(profile.id);
                  setUploadedFiles(profile.photoUrls.slice(0, 10));
                  setValidationError(null);
                }}
              />

              {!resultReady && !isGenerating && (
                <div
                  className={`relative mx-auto flex w-full max-w-sm flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center ${ASPECT_CLASS[aspectRatio]}`}
                >
                  <Wand2 className="mb-3 h-8 w-8 text-white/30" />
                  <p className="text-sm text-white/40">{t.creator.promptLabel}</p>
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

              {resultReady && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {drafts.map((url, idx) => {
                      const draftIdx = idx as 0 | 1;
                      const isFocused = focusedDraft === draftIdx;
                      return (
                        <button
                          key={`${url}-${idx}`}
                          type="button"
                          onClick={() => focusDraft(draftIdx)}
                          title={t.creator.focusDraft}
                          className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${ASPECT_CLASS[aspectRatio]} ${
                            isFocused
                              ? "border-glow-emerald/50 shadow-glow-sm"
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
                              <div className="absolute top-2 right-2 rounded-md bg-glow-emerald/20 px-2 py-1 text-[10px] font-medium text-glow-emerald">
                                {t.creator.resultReady}
                              </div>
                              <BrandWatermark visible={isFreePlan} />
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={regenerateBusy || !portraitId}
                    className="btn-secondary flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 shrink-0 ${regenerateBusy ? "animate-spin" : ""}`} />
                    <span>{regenerateBusy ? "..." : t.creator.regenerate}</span>
                  </button>
                </div>
              )}

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
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-glow-purple/40"
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
                disabled={isGenerating}
                className="btn-primary w-full py-3 text-sm disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4 shrink-0" />
                <span>{t.creator.generatePortrait}</span>
              </button>

              {resultReady && (
                <div className="space-y-4 border-t border-white/[0.06] pt-4">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-sm font-medium text-white/70">
                        {t.creator.retouchLabel}
                      </label>
                      <span className="text-[11px] text-white/45">
                        {t.creator.retouchFreeLeft.replace("{count}", String(freeRetouchesLeft))}
                      </span>
                    </div>
                    <textarea
                      value={retouchPrompt}
                      onChange={(e) => setRetouchPrompt(e.target.value)}
                      placeholder={t.creator.retouchPlaceholder}
                      rows={2}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-glow-purple/40"
                    />
                    <p className="mt-1.5 text-[11px] text-white/35">{t.creator.retouchCostHint}</p>
                    <button
                      type="button"
                      onClick={handleRetouch}
                      disabled={isRetouching || !retouchPrompt.trim()}
                      className="btn-secondary mt-3 w-full py-2.5 text-sm disabled:opacity-50"
                    >
                      {isRetouching ? "..." : t.creator.retouchApply}
                    </button>
                    {retouchMessage && (
                      <p className="mt-2 text-xs text-glow-emerald">{retouchMessage}</p>
                    )}
                  </div>

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
                        onClick={() => setExportPreset(key)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          exportPreset === key
                            ? "border-glow-emerald/50 bg-glow-emerald/10 text-white"
                            : "border-white/10 text-white/45 hover:border-white/20"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="btn-secondary flex w-full items-center justify-center gap-2 py-3 text-sm disabled:opacity-50"
                  >
                    <span>{isDownloading ? "..." : t.creator.downloadPortrait}</span>
                  </button>

                  <ThumbnailEditor imageUrl={focusedImageUrl} aspectRatio={aspectRatio} />
                </div>
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
                onClick={() => goToStep(3)}
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
