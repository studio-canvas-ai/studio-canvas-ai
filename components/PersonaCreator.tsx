"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import BrandWatermark from "@/components/BrandWatermark";
import {
  personaSpecIds,
  wizardStylePackIds,
  PROMPT_MAX_LENGTH,
  HERO_AFTER_IMAGE,
} from "@/lib/data";
import { downloadImageFile, type AspectRatioKey, type ExportPreset } from "@/lib/downloadImage";

const PERSONA_DEFAULTS = {
  gender: "female",
  age: "30s",
  vibe: "natural",
} as const;

const ASPECT_CLASS: Record<AspectRatioKey, string> = {
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
  "1:1": "aspect-square",
};

export default function PersonaCreator() {
  const { t } = useI18n();
  const { credits, maxCredits, isFreePlan, consumeCredit, setShowCreditModal } = useCredits();
  const stepContentRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selections, setSelections] = useState<Record<string, string>>({ ...PERSONA_DEFAULTS });
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [resultReady, setResultReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey>("9:16");
  const [exportPreset, setExportPreset] = useState<ExportPreset>("original");

  const steps = [
    { id: 1, title: t.creator.step1Title, icon: User, description: t.creator.step1Desc },
    { id: 2, title: t.creator.step2Title, icon: Upload, description: t.creator.step2Desc },
    { id: 3, title: t.creator.step3Title, icon: Palette, description: t.creator.step3Desc },
    { id: 4, title: t.creator.step4Title, icon: Wand2, description: t.creator.step4Desc },
  ];

  const categoryLabels: Record<string, string> = {
    gender: t.creator.gender,
    age: t.creator.age,
    vibe: t.creator.vibe,
  };

  const optionLabels: Record<string, Record<string, string>> = {
    gender: {
      female: t.creator.genderFemale,
      male: t.creator.genderMale,
      neutral: t.creator.genderNeutral,
    },
    age: {
      "20s": t.creator.age20s,
      "30s": t.creator.age30s,
      "40s": t.creator.age40s,
    },
    vibe: {
      elegant: t.creator.vibeElegant,
      bold: t.creator.vibeBold,
      natural: t.creator.vibeNatural,
      mysterious: t.creator.vibeMysterious,
    },
  };

  const resolvedSelections = { ...PERSONA_DEFAULTS, ...selections };

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    setValidationError(null);
    requestAnimationFrame(() => {
      stepContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const toggleSelection = (category: string, id: string) => {
    setSelections((prev) => ({ ...PERSONA_DEFAULTS, ...prev, [category]: id }));
    setValidationError(null);
  };

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setValidationError(null);
  };

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files).slice(0, 10 - uploadedFiles.length);
      const urls = files.map((f) => URL.createObjectURL(f));
      setUploadedFiles((prev) => [...prev, ...urls].slice(0, 10));
      setValidationError(null);
    },
    [uploadedFiles.length]
  );

  const handleNext = () => {
    if (currentStep === 1) {
      const missing: string[] = [];
      if (!resolvedSelections.gender) missing.push(t.creator.gender);
      if (!resolvedSelections.age) missing.push(t.creator.age);
      if (!resolvedSelections.vibe) missing.push(t.creator.vibe);
      if (missing.length) {
        setValidationError(
          t.creator.validationMissingFields.replace("{fields}", missing.join(", "))
        );
        return;
      }
      setSelections((prev) => ({ ...PERSONA_DEFAULTS, ...prev }));
      goToStep(2);
      return;
    }

    if (currentStep === 2) {
      if (uploadedFiles.length < 3) {
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

  const handleStartTraining = () => {
    if (selectedStyles.length < 1) {
      setValidationError(t.creator.validationStyleMin);
      return;
    }
    setValidationError(null);
    setIsTraining(true);
  };

  const handleGenerate = () => {
    if (credits <= 0) {
      setShowCreditModal(true);
      return;
    }
    if (!consumeCredit()) return;
    setIsGenerating(true);
    setResultReady(false);
    setTimeout(() => {
      setIsGenerating(false);
      setResultReady(true);
    }, 1800);
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadImageFile({
        imageUrl: HERO_AFTER_IMAGE,
        filename:
          exportPreset === "id-photo"
            ? `studio-canvas-id-photo-${Date.now()}.png`
            : `studio-canvas-hd-${Date.now()}.png`,
        bakeWatermark: isFreePlan,
        aspectRatio,
        exportPreset,
      });
    } catch {
      window.open(HERO_AFTER_IMAGE, "_blank", "noopener,noreferrer");
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
              {Object.entries(personaSpecIds).map(([category, options]) => (
                <div key={category}>
                  <h3 className="mb-4 text-sm font-medium tracking-wider text-white/60 uppercase">
                    {categoryLabels[category]}
                  </h3>
                  <div
                    className={`grid gap-3 ${
                      category === "vibe" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
                    }`}
                  >
                    {options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleSelection(category, option.id)}
                        className={`rounded-xl border p-3 text-center transition-all duration-300 sm:p-4 ${
                          resolvedSelections[category as keyof typeof PERSONA_DEFAULTS] === option.id
                            ? "border-glow-purple/50 bg-glow-purple/10 shadow-glow-sm"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
                        }`}
                      >
                        <div className="mb-1 text-xl sm:mb-2 sm:text-2xl">{option.icon}</div>
                        <div className="text-xs font-medium leading-tight sm:text-sm">
                          {optionLabels[category][option.id]}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isTraining && currentStep === 2 && (
            <div className="animate-fade-in space-y-6">
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
                <p className="text-xs text-white/40">{t.creator.uploadHint}</p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).slice(
                      0,
                      10 - uploadedFiles.length
                    );
                    const urls = files.map((f) => URL.createObjectURL(f));
                    setUploadedFiles((prev) => [...prev, ...urls].slice(0, 10));
                    setValidationError(null);
                    e.target.value = "";
                  }}
                />
              </div>

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
            <div className="animate-fade-in">
              <p className="mb-6 text-sm text-white/50">{t.creator.styleSelectHint}</p>
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
            </div>
          )}

          {!isTraining && currentStep === 4 && (
            <div className="animate-fade-in space-y-6">
              <div
                className={`relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 ${ASPECT_CLASS[aspectRatio]}`}
              >
                {(resultReady || isGenerating) && (
                  <img
                    src={HERO_AFTER_IMAGE}
                    alt=""
                    className={`h-full w-full object-cover object-[30%_35%] transition-opacity duration-500 ${
                      isGenerating ? "opacity-40 blur-sm" : "opacity-100"
                    }`}
                  />
                )}
                {!resultReady && !isGenerating && (
                  <div className="flex h-full flex-col items-center justify-center bg-white/[0.02] p-6 text-center">
                    <Wand2 className="mb-3 h-8 w-8 text-white/30" />
                    <p className="text-sm text-white/40">{t.creator.promptLabel}</p>
                  </div>
                )}
                {isGenerating && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-glow-purple/30 border-t-glow-purple" />
                  </div>
                )}
                {resultReady && (
                  <>
                    <div className="absolute top-3 left-3 rounded-md bg-glow-emerald/20 px-2 py-1 text-[10px] font-medium text-glow-emerald">
                      {t.creator.resultReady}
                    </div>
                    <BrandWatermark visible={isFreePlan} />
                  </>
                )}
              </div>

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
                <div className="space-y-3 border-t border-white/[0.06] pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExportPreset("original")}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        exportPreset === "original"
                          ? "border-glow-emerald/50 bg-glow-emerald/10 text-white"
                          : "border-white/10 text-white/45 hover:border-white/20"
                      }`}
                    >
                      {t.creator.exportOriginal}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportPreset("id-photo")}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        exportPreset === "id-photo"
                          ? "border-glow-emerald/50 bg-glow-emerald/10 text-white"
                          : "border-white/10 text-white/45 hover:border-white/20"
                      }`}
                    >
                      {t.creator.exportIdPhoto}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="btn-secondary flex w-full items-center justify-center gap-2 py-3 text-sm disabled:opacity-50"
                  >
                    <span>{isDownloading ? "..." : t.creator.downloadPortrait}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {validationError && !isTraining && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
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
