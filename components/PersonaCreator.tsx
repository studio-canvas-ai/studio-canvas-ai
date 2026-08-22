"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  Suspense,
  type ReactNode,
} from "react";
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
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import { useCredits } from "@/components/CreditsProvider";
import ResultWorkspace from "@/components/ResultWorkspace";
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
  MAX_SELFIE_UPLOADS,
  REGENERATE_CREDIT_COST,
  TRAIN_CREDIT_COST,
  DOWNLOAD_CREDIT_COST,
  CONCEPT_POSE_HINTS,
  BACKGROUND_TAG_IDS,
  BACKGROUND_MODE_IDS,
  type BackgroundModeId,
} from "@/lib/data";
import {
  pushGalleryHistoryAndSync,
  listGalleryHistory,
  listFaceProfiles,
  getFaceProfile,
  fetchFaceProfilesFromServer,
  fetchGalleryHistoryFromServer,
  upsertFaceProfile,
  getAccountMeta,
  type FaceProfile,
} from "@/lib/faceProfiles";
import { fetchGeneralPhoto } from "@/lib/generalPhotos";
import { uploadGalleryAsset } from "@/lib/galleryUpload";
import { retentionContextFromAccount } from "@/lib/retentionPolicy";
import { buildFaceConsistencyPayload, validateRegenerateDualReference } from "@/lib/faceConsistency";
import { resolveSelfieSourcesForGenerate } from "@/lib/resolveSelfieSources";
import {
  BackgroundFusionError,
  runBackgroundFusionGenerate,
} from "@/lib/backgroundFusionGenerate";
import { resolvePortraitGenerationPrompt } from "@/lib/ai/fusionPrompt";
import { apiFetchJson } from "@/lib/apiFetch";
import { processUploadFiles } from "@/lib/processUpload";
import { toProviderImageUrls } from "@/lib/toProviderImageUrl";
import { prepareGenerateImageUrls } from "@/lib/prepareGenerateImages";
import {
  ASPECT_RATIO_CLASS,
  DEFAULT_IMAGE_PAN,
  downloadImageFile,
  normalizeImagePan,
  resolveCanvasImageUrl,
  type AspectRatioKey,
  type DownloadQuality,
  type ExportPreset,
  type ImagePan,
} from "@/lib/downloadImage";
import { KAKAO_REGISTERED_ORIGIN, shareImageViaKakao } from "@/lib/kakaoShare";
import { isShareAbortError, shareWithFallback } from "@/lib/webShare";
import { readTrainSelection } from "@/lib/trainSelection";
import {
  clearResultSession,
  readResultSession,
  saveResultSession,
  toDisplayImageSrc,
  type ResultSession,
} from "@/lib/resultSession";
import { clearGenerateSessionScratch } from "@/lib/generateSession";
import { useFeedback } from "@/components/FeedbackProvider";

type SubjectId = (typeof subjectTypeOptions)[number]["id"];
type ResultView = "compare" | "detail";

const PERSONA_DEFAULTS = {
  subject: "male" as SubjectId,
  age: "30s",
};

const ACCEPT_ATTR =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";

/**
 * Temporary test bypass while Fal.ai integration is unfinished.
 * When enabled, training/generation failures still open the result workspace
 * with mock drafts derived from uploaded photos. Revert this to false later.
 */
const FORCE_RESULT_BYPASS_FOR_FAL_TEST = true;

function SoftAccordion({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm text-white/50 transition hover:text-white/80"
      >
        <span>{label}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open ? <div className="pb-1">{children}</div> : null}
    </div>
  );
}

/** Append unique photo URLs into existing slots (FIFO cap). */
function mergePhotoUrls(
  existing: string[],
  incoming: string[],
  max = MAX_SELFIE_UPLOADS
): string[] {
  const next = [...existing];
  for (const url of incoming) {
    const trimmed = url?.trim();
    if (!trimmed) continue;
    if (next.length >= max) break;
    if (!next.includes(trimmed)) next.push(trimmed);
  }
  return next;
}

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
    unlimitedCredits,
    creditsLabel,
    applyBrandWatermark,
    consumeCredit,
    applyServerCredits,
    setShowCreditModal,
    registerPortrait,
    requestRetouch,
    planId,
    refreshAccount,
  } = useCredits();
  const { confirm, showToast } = useFeedback();
  const stepContentRef = useRef<HTMLDivElement>(null);
  const trainingAbortRef = useRef(false);
  /** Prevents Strict Mode / query updates from re-hydrating the same gallery jump. */
  const galleryHydratedKeyRef = useRef<string | null>(null);
  const autoTrainArmedRef = useRef(false);
  /** Gallery → thumbnail edit track (no AI /api/generate). */
  const [directEditMode, setDirectEditMode] = useState(false);
  /** Face-model vault → Step 4 train (5 credits) path. */
  const [useTrainCredits, setUseTrainCredits] = useState(false);
  const [pendingAutoTrain, setPendingAutoTrain] = useState(false);
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
  const [regeneratingSlot, setRegeneratingSlot] = useState<0 | 1 | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [resultReady, setResultReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  /** Shared aspect used during pre-result generate UI / API payload. */
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey>("9:16");
  /** Independent crop settings per 시안 slot (0 = 시안 1, 1 = 시안 2). */
  const [draftAspectRatios, setDraftAspectRatios] = useState<
    [AspectRatioKey, AspectRatioKey]
  >(["9:16", "9:16"]);
  const [draftImagePans, setDraftImagePans] = useState<[ImagePan, ImagePan]>([
    { ...DEFAULT_IMAGE_PAN },
    { ...DEFAULT_IMAGE_PAN },
  ]);
  const [exportPreset, setExportPreset] = useState<ExportPreset>("original");
  const [directEditSource, setDirectEditSource] = useState<"photos" | "models" | null>(
    null
  );
  const [portraitId, setPortraitId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<FaceProfile[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [gallerySavedMsg, setGallerySavedMsg] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  /** After generation: compare (A/B pick) first, then detail (download/edit). */
  const [resultView, setResultView] = useState<ResultView>("compare");
  const [selectedResultUrl, setSelectedResultUrl] = useState("");
  const [confirmedImageUrl, setConfirmedImageUrl] = useState("");
  const [confirmedBlobUrl, setConfirmedBlobUrl] = useState("");
  const confirmedLockRef = useRef("");
  const confirmedBlobRef = useRef<string | null>(null);

  const isPerson = subject === "male" || subject === "female";
  /** Direct-edit prefers hydrated profile photos; never fall back to demo hero while loading. */
  const directEditImageUrl = drafts[0] || uploadedFiles[0] || "";
  const focusedImageUrl = (() => {
    const candidates = directEditMode
      ? [confirmedBlobUrl, confirmedImageUrl, selectedResultUrl, directEditImageUrl, uploadedFiles[0]]
      : resultView === "detail"
        ? [
            confirmedBlobUrl,
            confirmedImageUrl,
            selectedResultUrl,
            drafts[focusedDraft],
            drafts[0],
            drafts[1],
            uploadedFiles[0],
          ]
        : [
            drafts[focusedDraft],
            selectedResultUrl,
            drafts[0],
            drafts[1],
            uploadedFiles[0],
          ];
    const hit = candidates.find((url) => typeof url === "string" && url.trim().length > 8);
    return hit || "";
  })();
  const clearConfirmedImage = useCallback(() => {
    confirmedLockRef.current = "";
    setConfirmedImageUrl("");
    setConfirmedBlobUrl("");
    if (confirmedBlobRef.current) {
      URL.revokeObjectURL(confirmedBlobRef.current);
      confirmedBlobRef.current = null;
    }
  }, []);

  const snapshotConfirmedImage = useCallback(async (url: string) => {
    const picked = url.trim();
    if (!picked) return;
    confirmedLockRef.current = picked;
    setConfirmedImageUrl(picked);
    if (confirmedBlobRef.current) {
      URL.revokeObjectURL(confirmedBlobRef.current);
      confirmedBlobRef.current = null;
    }
    setConfirmedBlobUrl("");
    try {
      const src =
        picked.startsWith("data:") || picked.startsWith("blob:") || picked.startsWith("/")
          ? picked
          : toDisplayImageSrc(picked);
      const res = await fetch(src, { credentials: "same-origin" });
      if (!res.ok || confirmedLockRef.current !== picked) return;
      const blob = await res.blob();
      if (blob.size < 32 || confirmedLockRef.current !== picked) return;
      if (confirmedBlobRef.current) URL.revokeObjectURL(confirmedBlobRef.current);
      const objectUrl = URL.createObjectURL(blob);
      confirmedBlobRef.current = objectUrl;
      setConfirmedBlobUrl(objectUrl);
    } catch {
      /* keep confirmedImageUrl even if blob snapshot fails */
    }
  }, []);

  const replaceQuerySilently = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      if (typeof window === "undefined") return;
      try {
        const params = new URLSearchParams(window.location.search);
        mutate(params);
        const qs = params.toString();
        window.history.replaceState(
          window.history.state,
          "",
          `${pathname}${qs ? `?${qs}` : ""}`
        );
      } catch {
        /* ignore */
      }
    },
    [pathname]
  );

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const styleParam = params.get("style")?.trim() || "";
    const isGalleryJump = Boolean(
      params.get("photoId") ||
        params.get("profileId") ||
        params.get("profile") ||
        params.get("photoUrl") ||
        params.get("source") === "selection" ||
        params.get("autostart") === "train" ||
        params.get("mode") === "edit" ||
        params.get("mode") === "thumbnail"
    );
    const forceFresh =
      params.get("fresh") === "1" ||
      params.get("reset") === "1" ||
      params.get("new") === "1" ||
      // Style gallery entry must never restore a stale result session.
      (Boolean(styleParam) && !isGalleryJump);

    if (forceFresh) {
      clearGenerateSessionScratch();
      clearConfirmedImage();
      setResultReady(false);
      setResultView("compare");
      setDrafts([]);
      setFocusedDraft(0);
      setSelectedResultUrl("");
      setUploadedFiles([]);
      setSelectedProfileId(null);
      setPortraitId(null);
      setPrompt("");
      setDirectEditMode(false);
      setDirectEditSource(null);
      setUseTrainCredits(false);
      setGallerySavedMsg(false);
      setGenerationError(null);
      setActionMessage(null);
      setIsGenerating(false);
      setIsTraining(false);
      setRegenerateBusy(false);
      setRegeneratingSlot(null);
      setValidationError(null);
      setSubject(PERSONA_DEFAULTS.subject);
      setAge(PERSONA_DEFAULTS.age);
      setBackgroundMode("auto");
      setBackgroundTags([]);
      setBackgroundCustom("");
      setAspectRatio("9:16");
      setDraftAspectRatios(["9:16", "9:16"]);
      setDraftImagePans([{ ...DEFAULT_IMAGE_PAN }, { ...DEFAULT_IMAGE_PAN }]);
      setExportPreset("original");
      galleryHydratedKeyRef.current = null;
      autoTrainArmedRef.current = false;

      if (styleParam) {
        // Concept gallery → lock style and land on subject/age (step 2).
        setSelectedStyles([styleParam]);
        setStyleLocked(true);
        setCurrentStep(2);
        setMaxStepReached(2);
      } else {
        setSelectedStyles([]);
        setStyleLocked(false);
        setCurrentStep(1);
        setMaxStepReached(1);
      }

      try {
        const next = new URLSearchParams(params);
        next.delete("fresh");
        next.delete("reset");
        next.delete("new");
        const qs = next.toString();
        window.history.replaceState(
          window.history.state,
          "",
          `${pathname}${qs ? `?${qs}` : ""}`
        );
      } catch {
        /* ignore */
      }
      return;
    }

    if (params.get("autostart") === "train") return;
    // Direct-edit jumps must not restore a stale AI result session.
    const mode = params.get("mode");
    if (mode === "edit" || mode === "thumbnail") return;
    if (params.get("photoId") || params.get("profileId") || params.get("profile")) {
      return;
    }
    const session = readResultSession();
    if (!session?.drafts.length || !session.resultReady) return;
    setDrafts(session.drafts);
    setFocusedDraft(session.focusedDraft);
    setSelectedResultUrl(session.selectedResultUrl);
    if (session.resultView === "detail" && session.selectedResultUrl) {
      void snapshotConfirmedImage(session.selectedResultUrl);
    }
    setResultReady(true);
    setResultView(session.resultView);
    setDirectEditMode(Boolean(session.directEditMode));
    if (session.directEditMode) {
      setAspectRatio("original");
      setDraftAspectRatios(["original", "original"]);
      setDraftImagePans([{ ...DEFAULT_IMAGE_PAN }, { ...DEFAULT_IMAGE_PAN }]);
    }
    setCurrentStep(session.resultView === "detail" ? 5 : 4);
    setMaxStepReached(session.resultView === "detail" ? 5 : 4);
    if (session.portraitId) setPortraitId(session.portraitId);
    if (session.profileId) setSelectedProfileId(session.profileId);
    if (session.selfieUrls?.length) {
      setUploadedFiles((prev) =>
        prev.length > 0 ? prev : session.selfieUrls!.slice(0, MAX_SELFIE_UPLOADS)
      );
    }
  }, [clearConfirmedImage, pathname]);

  // Keep style lock in sync if query still has style (e.g. after stripping fresh=1).
  useEffect(() => {
    const style = searchParams.get("style")?.trim();
    if (!style) return;
    const isGalleryJump =
      searchParams.get("photoId") ||
      searchParams.get("profileId") ||
      searchParams.get("profile") ||
      searchParams.get("photoUrl") ||
      searchParams.get("source") === "selection" ||
      searchParams.get("mode") === "edit" ||
      searchParams.get("mode") === "thumbnail";
    if (isGalleryJump) return;

    setSelectedStyles((prev) => (prev.includes(style) ? prev : [style]));
    setStyleLocked(true);
    setCurrentStep((step) => (step < 2 ? 2 : step));
    setMaxStepReached((step) => Math.max(step, 2));
  }, [searchParams]);

  // Gallery → skip steps 1–4, land on step 5 with the finished portrait as face model.
  useEffect(() => {
    const intent = searchParams.get("intent");
    if (intent !== "portrait") return;
    const photoUrlRaw = searchParams.get("photoUrl");
    const workId = searchParams.get("workId") ?? "";
    const styleParam = searchParams.get("style")?.trim() || "";
    if (!photoUrlRaw) return;
    const hydrateKey = `portrait::${workId}::${photoUrlRaw}`;
    if (galleryHydratedKeyRef.current === hydrateKey) return;

    void (async () => {
      let decoded = photoUrlRaw;
      try {
        decoded = decodeURIComponent(photoUrlRaw);
      } catch {
        /* keep raw */
      }
      if (!decoded) return;

      galleryHydratedKeyRef.current = hydrateKey;
      clearResultSession();

      await fetchFaceProfilesFromServer();
      let work = workId ? listGalleryHistory().find((w) => w.id === workId) : undefined;
      if (workId && !work) {
        const remote = await fetchGalleryHistoryFromServer();
        work = remote.find((w) => w.id === workId);
      }

      const profileIdParam =
        searchParams.get("profileId") ?? searchParams.get("profile");
      let linkedProfileId = profileIdParam || work?.profileId || null;
      let selfies = (work?.selfieUrls || []).filter(
        (u): u is string => typeof u === "string" && u.trim().length > 8
      );

      if (!selfies.length && linkedProfileId) {
        const profile = getFaceProfile(linkedProfileId);
        if (profile?.photoUrls?.length) {
          selfies = profile.photoUrls.filter(
            (u): u is string => typeof u === "string" && u.trim().length > 8
          );
        }
      }

      // Draft = finished work; selfies = original training photos only (never the work URL).
      selfies = selfies.filter((u) => u.trim() !== decoded.trim()).slice(0, 10);

      const styleId = styleParam || work?.styleId || stylePacksMeta[0]?.id;
      if (styleId) {
        setSelectedStyles([styleId]);
        setStyleLocked(Boolean(styleParam || work?.styleId));
      }
      if (linkedProfileId) {
        setSelectedProfileId(linkedProfileId);
      }
      setUploadedFiles(selfies);
      setDrafts([decoded, decoded]);
      setFocusedDraft(0);
      setSelectedResultUrl(decoded);
      setDraftAspectRatios(["9:16", "9:16"]);
      setDraftImagePans([{ ...DEFAULT_IMAGE_PAN }, { ...DEFAULT_IMAGE_PAN }]);
      setResultReady(true);
      setResultView("detail");
      setDirectEditMode(false);
      setDirectEditSource(null);
      setCurrentStep(5);
      setMaxStepReached(5);
      setUseTrainCredits(false);
      setPendingAutoTrain(false);
      if (workId) {
        setPortraitId(workId.replace(/-\d+$/, "") || workId);
      }
      void snapshotConfirmedImage(decoded);
      saveResultSession({
        drafts: [decoded, decoded],
        focusedDraft: 0,
        selectedResultUrl: decoded,
        resultView: "detail",
        resultReady: true,
        portraitId: workId || null,
        directEditMode: false,
        selfieUrls: selfies,
        profileId: linkedProfileId,
      });
      replaceQuerySilently((params) => {
        params.delete("intent");
        params.delete("workId");
        params.delete("photoUrl");
        params.delete("profileId");
        params.delete("profile");
        params.set("view", "detail");
      });
    })();
  }, [replaceQuerySilently, searchParams, snapshotConfirmedImage]);

  // Gallery jump: profileId / photoId / photoUrl — AI track or direct thumbnail-edit track.
  useEffect(() => {
    const photoUrlRaw = searchParams.get("photoUrl");
    const profileId =
      searchParams.get("profileId") ?? searchParams.get("profile");
    const photoId = searchParams.get("photoId");
    const mode = searchParams.get("mode");
    const source = searchParams.get("source");
    const intent = searchParams.get("intent") ?? searchParams.get("autostart");
    if (intent === "portrait") return;
    const isDirectEdit = mode === "edit" || mode === "thumbnail";
    const isTrainIntent = (intent === "train" || source === "selection") && !isDirectEdit;
    const shouldAutoTrain = isTrainIntent && searchParams.get("autostart") === "train";
    if (!photoUrlRaw && !profileId && !photoId && source !== "selection") return;

    const hydrateKey = `${profileId ?? ""}::${photoId ?? ""}::${photoUrlRaw ?? ""}::${mode ?? ""}::${source ?? ""}`;
    if (galleryHydratedKeyRef.current === hydrateKey) return;

    let cancelled = false;

    const readCachedPhotos = (id: string): string[] => {
      try {
        const cached = sessionStorage.getItem(`sca_generate_photos_${id}`);
        if (!cached) return [];
        const parsed = JSON.parse(cached) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 10);
      } catch {
        return [];
      }
    };

    void (async () => {
      let files: string[] = [];

      if (source === "selection") {
        files = readTrainSelection();
      }

      if (profileId) {
        // Hydrate vault from R2 before reading the selected profile.
        await fetchFaceProfilesFromServer();
        const profile = getFaceProfile(profileId);
        if (profile?.photoUrls?.length) {
          files = profile.photoUrls.slice(0, 10);
        }
        if (files.length < 1) {
          files = readCachedPhotos(profileId);
        }
      }

      if (photoId) {
        const general = await fetchGeneralPhoto(photoId);
        if (general?.imageUrl) {
          files = [general.imageUrl, ...files.filter((u) => u !== general.imageUrl)].slice(
            0,
            10
          );
        }
        if (files.length < 1) {
          files = readCachedPhotos(photoId);
        }
      }

      if (photoUrlRaw) {
        let decoded = photoUrlRaw;
        try {
          decoded = decodeURIComponent(photoUrlRaw);
        } catch {
          /* keep raw */
        }
        if (decoded && !decoded.startsWith("local:")) {
          files = [decoded, ...files.filter((u) => u !== decoded)].slice(0, 10);
        }
      }

      if (files.length < 1) return;

      // Prefer durable data:/http URLs, but keep originals if encode fails
      // so a valid local profile photo still reaches the editor.
      let durableFiles = files;
      try {
        durableFiles = await toProviderImageUrls(files);
      } catch (err) {
        console.warn("[PersonaCreator] profile photo durable encode failed", err);
        durableFiles = files;
      }
      if (cancelled || durableFiles.length < 1) return;

      galleryHydratedKeyRef.current = hydrateKey;

      const existingResult = readResultSession();

      if (profileId) {
        setSelectedProfileId(profileId);
        const profile = getFaceProfile(profileId);
        if (profile) {
          upsertFaceProfile({
            ...profile,
            photoUrls: durableFiles,
            updatedAt: Date.now(),
          });
        }
        try {
          sessionStorage.setItem(
            `sca_generate_photos_${profileId}`,
            JSON.stringify(durableFiles)
          );
        } catch {
          /* quota — profile localStorage remains source of truth */
        }
      }

      if (photoId) {
        try {
          sessionStorage.setItem(
            `sca_generate_photos_${photoId}`,
            JSON.stringify(durableFiles)
          );
        } catch {
          /* quota */
        }
      }

      setUploadedFiles(durableFiles);
      setSavedProfiles(listFaceProfiles());
      setValidationError(null);
      setGenerationError(null);
      setIsTraining(false);
      setIsGenerating(false);
      setDirectEditMode(isDirectEdit);
      setDraftImagePans([{ ...DEFAULT_IMAGE_PAN }, { ...DEFAULT_IMAGE_PAN }]);
      setCurrentStep(4);
      setMaxStepReached(4);

      if (isDirectEdit) {
        setDirectEditSource(photoId ? "photos" : profileId ? "models" : null);
        setAspectRatio("original");
        setDraftAspectRatios(["original", "original"]);
        setDraftImagePans([{ ...DEFAULT_IMAGE_PAN }, { ...DEFAULT_IMAGE_PAN }]);
        // Standard compare template — 시안 1 only (시안 2 hidden).
        const original = durableFiles[0];
        setDrafts([original]);
        setFocusedDraft(0);
        setSelectedResultUrl(original);
        setResultReady(true);
        setResultView("detail");
        setSelectedStyles((prev) =>
          prev.length > 0 ? prev : ([stylePacksMeta[0]?.id].filter(Boolean) as string[])
        );
        setUseTrainCredits(false);
        setPendingAutoTrain(false);
        setCurrentStep(5);
        setMaxStepReached(5);
        void snapshotConfirmedImage(original);
        saveResultSession({
          drafts: [original],
          focusedDraft: 0,
          selectedResultUrl: original,
          resultView: "detail",
          resultReady: true,
          portraitId: null,
          directEditMode: true,
        });
        return;
      }

      setDirectEditSource(null);

      if (
        existingResult?.drafts.length &&
        existingResult.resultReady &&
        !shouldAutoTrain
      ) {
        setDrafts(existingResult.drafts);
        setFocusedDraft(existingResult.focusedDraft);
        setSelectedResultUrl(existingResult.selectedResultUrl);
        setResultReady(true);
        setResultView(existingResult.resultView);
        setUseTrainCredits(false);
        setPendingAutoTrain(false);
        setSelectedStyles((prev) =>
          prev.length > 0 ? prev : ([stylePacksMeta[0]?.id].filter(Boolean) as string[])
        );
        setCurrentStep(existingResult.resultView === "detail" ? 5 : 4);
        setMaxStepReached(existingResult.resultView === "detail" ? 5 : 4);
        return;
      }

      setResultReady(false);
      setResultView("compare");
      setSelectedStyles((prev) =>
        prev.length > 0 ? prev : ([stylePacksMeta[0]?.id].filter(Boolean) as string[])
      );
      setUseTrainCredits(Boolean(profileId) || isTrainIntent);
      if (shouldAutoTrain) {
        setPendingAutoTrain(true);
        autoTrainArmedRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (currentStep !== 3) return;
    let cancelled = false;
    void fetchFaceProfilesFromServer().then((list) => {
      if (!cancelled) setSavedProfiles(list);
    });
    return () => {
      cancelled = true;
    };
  }, [currentStep]);

  const steps = [
    { id: 1, title: t.creator.step1Title, icon: Palette, description: t.creator.step1Desc },
    { id: 2, title: t.creator.step2Title, icon: User, description: t.creator.step2Desc },
    { id: 3, title: t.creator.step3Title, icon: Upload, description: t.creator.step3Desc },
    { id: 4, title: t.creator.step4Title, icon: Wand2, description: t.creator.step4Desc },
    { id: 5, title: t.creator.step5Title, icon: Sparkles, description: t.creator.step5Desc },
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

  /** Face + style + background fusion prompt for /api/generate (never simple paste). */
  const buildFusionPromptForApi = useCallback(
    (opts?: { keywordOverride?: string; additionalPrompt?: string }) => {
      const styleId = selectedStyles[0];
      return resolvePortraitGenerationPrompt({
        styleIds: selectedStyles,
        background: {
          mode: backgroundMode,
          tags: backgroundTags,
          custom: backgroundCustom,
          keywordOverride: opts?.keywordOverride,
        },
        additionalPrompt: opts?.additionalPrompt ?? prompt,
        poseHint: styleId ? CONCEPT_POSE_HINTS[styleId] : undefined,
      });
    },
    [selectedStyles, backgroundMode, backgroundTags, backgroundCustom, prompt]
  );

  const persistResultSession = useCallback(
    (session: ResultSession) => {
      saveResultSession({
        ...session,
        selfieUrls:
          session.selfieUrls ??
          resolveSelfieSourcesForGenerate({
            uploadedFiles,
            selectedProfileId,
          }),
        profileId: session.profileId ?? selectedProfileId,
      });
    },
    [selectedProfileId, uploadedFiles]
  );

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
    if (directEditMode) {
      router.push("/gallery/my?tab=models");
      return;
    }
    if (currentStep === 5) {
      if (resultReady && resultView === "detail") {
        setResultView("compare");
        goToStep(4, { scroll: false });
        return;
      }
      goToStep(4, { scroll: false });
      return;
    }
    if (currentStep === 4) {
      if (resultReady && resultView === "compare") {
        goToStep(3, { scroll: false });
        return;
      }
      goToStep(3, { scroll: false });
      return;
    }
    goToStep(Math.max(1, currentStep - 1), { scroll: false });
  }, [
    currentStep,
    directEditMode,
    goToStep,
    isTraining,
    resultReady,
    resultView,
    router,
  ]);

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
      if (uploadedFiles.length >= MAX_SELFIE_UPLOADS) {
        setValidationError(
          fillCanvas(t.creator.uploadLimitFull, { max: MAX_SELFIE_UPLOADS })
        );
        return;
      }
      setIsUploading(true);
      setValidationError(null);
      try {
        const remaining = MAX_SELFIE_UPLOADS - uploadedFiles.length;
        const { ok, errors } = await processUploadFiles(fileList, remaining);
        if (ok.length) {
          setUploadedFiles((prev) =>
            mergePhotoUrls(
              prev,
              ok.map((f) => f.url),
              MAX_SELFIE_UPLOADS
            )
          );
        }
        if (errors.length) {
          setValidationError(mapUploadErrors(errors));
        } else if (fileList.length > remaining) {
          setValidationError(
            fillCanvas(t.creator.uploadLimitFull, { max: MAX_SELFIE_UPLOADS })
          );
        }
      } finally {
        setIsUploading(false);
      }
    },
    [uploadedFiles.length, mapUploadErrors, t.creator.uploadLimitFull]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (uploadedFiles.length >= MAX_SELFIE_UPLOADS) {
        setValidationError(
          fillCanvas(t.creator.uploadLimitFull, { max: MAX_SELFIE_UPLOADS })
        );
        return;
      }
      void ingestFiles(Array.from(e.dataTransfer.files));
    },
    [ingestFiles, uploadedFiles.length, t.creator.uploadLimitFull]
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
    // Fresh pictorial run from in-wizard style pick — drop stale drafts/photos.
    clearGenerateSessionScratch();
    clearConfirmedImage();
    setDrafts([]);
    setResultReady(false);
    setSelectedResultUrl("");
    setUploadedFiles([]);
    setSelectedStyles([id]);
    setStyleLocked(true);
    setValidationError(null);
    goToStep(2);
  };

  const confirmDraftAndGoToEdit = useCallback(
    (idx: 0 | 1) => {
      const url = drafts[idx] || drafts[0] || selectedResultUrl || "";
      if (!url.trim()) return;
      setFocusedDraft(idx);
      setSelectedResultUrl(url);
      void snapshotConfirmedImage(url);
      setResultView("detail");
      setCurrentStep(5);
      setMaxStepReached((prev) => Math.max(prev, 5));
      persistResultSession({
        drafts,
        focusedDraft: idx,
        selectedResultUrl: url,
        resultView: "detail",
        resultReady: true,
        portraitId,
        directEditMode: false,
      });
      replaceQuerySilently((params) => {
        params.set("view", "detail");
      });
    },
    [
      drafts,
      persistResultSession,
      portraitId,
      replaceQuerySilently,
      selectedResultUrl,
      snapshotConfirmedImage,
    ]
  );

  const focusDraft = (idx: 0 | 1) => {
    setFocusedDraft(idx);
    setAspectRatio(draftAspectRatios[idx] ?? aspectRatio);
    const picked = drafts[idx] || selectedResultUrl || drafts[0] || "";
    if (picked) setSelectedResultUrl(picked);
    persistResultSession({
      drafts,
      focusedDraft: idx,
      selectedResultUrl: picked,
      resultView,
      resultReady,
      portraitId,
      directEditMode,
    });
  };

  const toggleBackgroundTag = (tag: string) => {
    setBackgroundTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const openMockResultWorkspace = useCallback((): boolean => {
    const primary =
      uploadedFiles[0] || uploadedFiles[1] || drafts[0] || selectedResultUrl || "";
    const secondary =
      uploadedFiles[1] || uploadedFiles[0] || drafts[1] || primary || "";
    if (!primary || !secondary) return false;

    const fakePortraitId = portraitId || `mock-${Date.now()}`;
    setCurrentStep(4);
    setMaxStepReached((prev) => (prev < 4 ? 4 : prev));
    setDirectEditMode(false);
    setIsGenerating(false);
    setIsTraining(false);
    setTrainingProgress(100);
    setGenerationError(null);
    setActionMessage("Fal.ai 연동 전 테스트용 모의 결과 화면입니다.");
    setPortraitId(fakePortraitId);
    setDrafts([primary, secondary]);
    setFocusedDraft(0);
    setDraftAspectRatios([aspectRatio, aspectRatio]);
    setDraftImagePans([{ ...DEFAULT_IMAGE_PAN }, { ...DEFAULT_IMAGE_PAN }]);
    setSelectedResultUrl(primary);
    setResultView("compare");
    setResultReady(true);
    setCurrentStep(4);
    setMaxStepReached((prev) => Math.max(prev, 4));
    setUseTrainCredits(false);
    saveResultSession({
      drafts: [primary, secondary],
      focusedDraft: 0,
      selectedResultUrl: primary,
      resultView: "compare",
      resultReady: true,
      portraitId: fakePortraitId,
      directEditMode: false,
    });
    replaceQuerySilently((params) => {
      params.set("view", "detail");
      params.delete("autostart");
      params.delete("intent");
      params.delete("mode");
    });
    return true;
  }, [
    aspectRatio,
    drafts,
    portraitId,
    replaceQuerySilently,
    selectedResultUrl,
    snapshotConfirmedImage,
    uploadedFiles,
  ]);

  /** Runs portrait generation + gallery save. Returns false if blocked (e.g. no credits). */
  const runInitialGeneration = useCallback(async (opts?: { train?: boolean }): Promise<boolean> => {
    // Direct thumbnail-edit track never hits the AI generate API.
    if (directEditMode) return false;

    const trainMode = opts?.train ?? useTrainCredits;
    const creditNeed = trainMode ? TRAIN_CREDIT_COST : 1;
    if (!unlimitedCredits && credits < creditNeed) {
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

    let providerSelfies: string[];
    try {
      // Compress + Fal CDN upload first — never POST multi-MB data URIs to /api/generate.
      providerSelfies = await prepareGenerateImageUrls(uploadedFiles);
    } catch (err) {
      console.error("[PersonaCreator] selfie encode/upload failed", err);
      if (FORCE_RESULT_BYPASS_FOR_FAL_TEST && openMockResultWorkspace()) {
        return true;
      }
      setGenerationError(t.creator.generateNetworkError);
      showToast(t.creator.generateFailed, "error");
      setIsGenerating(false);
      return false;
    }

    const facePayload = buildFaceConsistencyPayload({
      mode: trainMode ? "train" : "initial",
      selfieUrls: providerSelfies,
      ...buildFusionPromptForApi(),
      fusionMode: "full_rerender",
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
        creditsAfter?: number;
        message?: string;
      }>("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facePayload),
      });

      if (result.error === "network" || result.status === 0) {
        console.error("[PersonaCreator] generate network failure", result);
        if (FORCE_RESULT_BYPASS_FOR_FAL_TEST && openMockResultWorkspace()) {
          return true;
        }
        setGenerationError(t.creator.generateNetworkError);
        showToast(t.creator.generateFailed, "error");
        setIsGenerating(false);
        return false;
      }

      const data = result.data;
      if (result.status === 402) {
        if (FORCE_RESULT_BYPASS_FOR_FAL_TEST && openMockResultWorkspace()) {
          return true;
        }
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
        const serverMessage =
          typeof data?.message === "string" && data.message.trim()
            ? data.message.trim()
            : typeof data?.error === "string" && data.error.trim()
              ? data.error.trim()
              : null;
        const errMsg = data?.refunded
          ? t.creator.generateFailedRefunded
          : serverMessage || t.creator.generateFailed;
        if (FORCE_RESULT_BYPASS_FOR_FAL_TEST && openMockResultWorkspace()) {
          return true;
        }
        setGenerationError(errMsg);
        showToast(errMsg, "error");
        if (typeof data?.creditsAfter === "number") {
          applyServerCredits(data.creditsAfter);
        } else if (data?.refunded) {
          await refreshAccount();
        }
        setIsGenerating(false);
        return false;
      }
      urls = data.imageUrls;
      serverDebited = Boolean(data.ledgerId);
      if (typeof data.creditsAfter === "number") {
        applyServerCredits(data.creditsAfter);
      } else if (serverDebited) {
        await refreshAccount();
      }
    } catch (err) {
      console.error("[PersonaCreator] generate unexpected error", err);
      if (FORCE_RESULT_BYPASS_FOR_FAL_TEST && openMockResultWorkspace()) {
        return true;
      }
      setGenerationError(t.creator.generateNetworkError);
      showToast(t.creator.generateFailed, "error");
      setIsGenerating(false);
      return false;
    }

    if (!serverDebited && !consumeCredit(creditNeed)) {
      setShowCreditModal(true);
      setIsGenerating(false);
      return false;
    }

    registerPortrait(`${base}-0`);
    registerPortrait(`${base}-1`);
    setPortraitId(base);
    const draftA = urls[0];
    const draftB = urls[1] ?? urls[0];
    setDirectEditMode(false);
    setDrafts([draftA, draftB]);
    setFocusedDraft(0);
    setDraftAspectRatios([aspectRatio, aspectRatio]);
    setDraftImagePans([{ ...DEFAULT_IMAGE_PAN }, { ...DEFAULT_IMAGE_PAN }]);
    setSelectedResultUrl(draftA);
    setResultView("compare");
    setResultReady(true);
    setCurrentStep(4);
    setMaxStepReached((prev) => Math.max(prev, 4));
    setUseTrainCredits(false);
    persistResultSession({
      drafts: [draftA, draftB],
      focusedDraft: 0,
      selectedResultUrl: draftA,
      resultView: "compare",
      resultReady: true,
      portraitId: base,
      directEditMode: false,
      selfieUrls: uploadedFiles.slice(0, 10),
      profileId: selectedProfileId,
    });
    replaceQuerySilently((params) => {
      params.delete("view");
      params.delete("autostart");
      params.delete("intent");
      params.delete("mode");
    });

    // Release generate lock before gallery upload so step-5 tools (배경 생성) stay usable.
    setIsGenerating(false);

    const styleId = selectedStyles[0];
    const now = Date.now();
    const meta = getAccountMeta();
    const retentionCtx = retentionContextFromAccount(planId, meta);

    const draftsToSave: { id: string; url: string }[] = [
      { id: `${base}-0`, url: draftA },
      { id: `${base}-1`, url: draftB },
    ];

    const durableDrafts = [draftA, draftB];
    for (let i = 0; i < draftsToSave.length; i++) {
      const draft = draftsToSave[i];
      const uploaded = await uploadGalleryAsset(draft.url, draft.id, planId);
      const durable = uploaded?.imageUrl || uploaded?.thumbnailUrl || draft.url;
      durableDrafts[i] = durable;
      await pushGalleryHistoryAndSync(
        {
          id: draft.id,
          imageUrl: durable,
          thumbnailUrl: uploaded?.thumbnailUrl,
          originalKey: uploaded?.originalKey,
          storageId: uploaded?.storageId ?? draft.id,
          createdAt: draft.id.endsWith("-0") ? now : now + 1,
          styleId,
          profileId: selectedProfileId ?? undefined,
          profileName: selectedProfileId
            ? getFaceProfile(selectedProfileId)?.name
            : undefined,
          selfieUrls: uploadedFiles.slice(0, 10),
        },
        retentionCtx
      );
    }
    setDrafts([durableDrafts[0], durableDrafts[1]]);
    setSelectedResultUrl((prev) => {
      if (confirmedLockRef.current) return prev;
      const next =
        prev === draftA
          ? durableDrafts[0]
          : prev === draftB
            ? durableDrafts[1]
            : prev || durableDrafts[0];
      persistResultSession({
        drafts: [durableDrafts[0], durableDrafts[1]],
        focusedDraft: prev === draftB || prev === durableDrafts[1] ? 1 : 0,
        selectedResultUrl: next,
        resultView: "detail",
        resultReady: true,
        portraitId: base,
        directEditMode: false,
        selfieUrls: uploadedFiles.slice(0, 10),
        profileId: selectedProfileId,
      });
      return next;
    });

    setGallerySavedMsg(true);
    return true;
  }, [
    aspectRatio,
    applyServerCredits,
    consumeCredit,
    credits,
    directEditMode,
    unlimitedCredits,
    planId,
    prompt,
    refreshAccount,
    registerPortrait,
    replaceQuerySilently,
    selectedStyles,
    setShowCreditModal,
    showToast,
    t.creator.generateFailed,
    t.creator.generateFailedRefunded,
    t.creator.generateNetworkError,
    uploadedFiles,
    useTrainCredits,
    snapshotConfirmedImage,
    buildFusionPromptForApi,
    openMockResultWorkspace,
  ]);

  const handleStartTraining = (opts?: { train?: boolean }) => {
    if (directEditMode) return;
    if (selectedStyles.length < 1) {
      setValidationError(t.creator.validationStyleMin);
      return;
    }
    if (uploadedFiles.length < MIN_SELFIE_UPLOADS) {
      setValidationError(t.creator.validationUploadMin);
      return;
    }
    const trainMode =
      opts?.train === true || useTrainCredits || Boolean(selectedProfileId);
    const creditNeed = trainMode ? TRAIN_CREDIT_COST : 1;
    if (!unlimitedCredits && credits < creditNeed) {
      setShowCreditModal(true);
      return;
    }
    setUseTrainCredits(trainMode);
    setValidationError(null);
    clearResultSession();
    clearConfirmedImage();
    trainingAbortRef.current = false;
    setCurrentStep(4);
    setMaxStepReached((prev) => (prev < 4 ? 4 : prev));
    setTrainingProgress(0);
    setIsTraining(true);
    setResultView("compare");
    setResultReady(false);
    setSelectedResultUrl("");
    setDirectEditMode(false);

    void (async () => {
      const progressTimer = window.setInterval(() => {
        setTrainingProgress((p) => (p >= 90 ? p : Math.min(90, p + 8)));
      }, 400);
      try {
        const ok = await runInitialGeneration({ train: trainMode });
        if (trainingAbortRef.current) return;
        setTrainingProgress(100);
        setCurrentStep(4);
        setMaxStepReached((prev) => (prev < 4 ? 4 : prev));
        setResultView("compare");
        setDirectEditMode(false);
        if (ok) setResultReady(true);
      } catch (err) {
        console.error("[PersonaCreator] handleStartTraining fallback", err);
        if (FORCE_RESULT_BYPASS_FOR_FAL_TEST) {
          openMockResultWorkspace();
        }
      } finally {
        window.clearInterval(progressTimer);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        setIsTraining(false);
      }
      if (trainingAbortRef.current) return;
      requestAnimationFrame(() => {
        stepContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    })();
  };

  useEffect(() => {
    if (!pendingAutoTrain || directEditMode) return;
    if (uploadedFiles.length < MIN_SELFIE_UPLOADS) return;
    if (selectedStyles.length < 1) return;
    if (autoTrainArmedRef.current) return;
    if (isTraining || isGenerating || resultReady) return;
    autoTrainArmedRef.current = true;
    setPendingAutoTrain(false);
    handleStartTraining({ train: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingAutoTrain,
    directEditMode,
    uploadedFiles.length,
    selectedStyles.length,
    isTraining,
    isGenerating,
    resultReady,
  ]);

  const handleGenerate = () => {
    if (directEditMode) return;
    if (selectedStyles.length < 1) {
      setValidationError(t.creator.validationStyleMin);
      return;
    }
    if (uploadedFiles.length < MIN_SELFIE_UPLOADS) {
      setValidationError(t.creator.validationUploadMin);
      return;
    }
    setValidationError(null);
    void runInitialGeneration();
  };

  const handleRegenerate = () => {
    if (directEditMode) return;
    if (regenerateBusy || isGenerating) return;
    const targetSlot: 0 | 1 = focusedDraft === 1 ? 1 : 0;
    const sourceDraft =
      drafts[targetSlot] || selectedResultUrl || confirmedImageUrl || drafts[0] || "";
    if (!sourceDraft.trim()) {
      setActionMessage(t.creator.regenerateNeedDraft);
      return;
    }
    if (!unlimitedCredits && credits < REGENERATE_CREDIT_COST) {
      setShowCreditModal(true);
      return;
    }

    const selfieSources = resolveSelfieSourcesForGenerate({
      uploadedFiles,
      selectedProfileId,
      draftFallback: sourceDraft,
    });
    if (selfieSources.length < 1) {
      setActionMessage(t.creator.bgFusionNeedSelfies);
      return;
    }

    const pid = portraitId || `portrait-${Date.now()}`;
    if (!portraitId) {
      setPortraitId(pid);
      registerPortrait(`${pid}-0`);
      registerPortrait(`${pid}-1`);
    }

    setRegenerateBusy(true);
    setRegeneratingSlot(targetSlot);
    setActionMessage(null);
    const id = `${pid}-${targetSlot}`;

    void (async () => {
      let nextUrl: string | null = null;
      let serverDebited = false;
      try {
        const providerSelfies = await prepareGenerateImageUrls(selfieSources);
        const [providerDraft] = await prepareGenerateImageUrls([sourceDraft], {
          maxImages: 1,
        });
        const dualRef = validateRegenerateDualReference({
          selfieUrls: providerSelfies,
          draftUrl: providerDraft,
          userMessages: {
            missingSelfies: t.creator.validationUploadMin,
            missingDraft: t.creator.regenerateNeedDraft,
          },
        });
        if (!dualRef.ok) {
          setActionMessage(dualRef.message);
          setRegenerateBusy(false);
          setRegeneratingSlot(null);
          return;
        }
        const { prompt: fusionPrompt, backgroundScene } = buildFusionPromptForApi();
        const facePayload = buildFaceConsistencyPayload({
          mode: "regenerate",
          selfieUrls: dualRef.selfieUrls,
          draftUrl: dualRef.draftUrl,
          prompt: fusionPrompt,
          backgroundScene,
          fusionMode: "edit_draft",
          aspectRatio: draftAspectRatios[targetSlot] ?? aspectRatio,
          styleIds: selectedStyles,
        });
        const result = await apiFetchJson<{
          imageUrls?: string[];
          error?: string;
          refunded?: boolean;
          ledgerId?: string | null;
          creditsAfter?: number;
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
          setRegeneratingSlot(null);
          return;
        }

        const data = result.data;
        if (result.status === 402) {
          setShowCreditModal(true);
          setRegenerateBusy(false);
          setRegeneratingSlot(null);
          return;
        }
        if (result.status === 429) {
          setActionMessage(t.creator.retouchThrottle);
          setRegenerateBusy(false);
          setRegeneratingSlot(null);
          return;
        }
        if (!result.ok || !data?.imageUrls?.length) {
          console.error("[PersonaCreator] regenerate failed", {
            status: result.status,
            error: result.error,
            serverError: data?.error ?? data?.message,
            preview: result.rawPreview,
          });
          const serverMessage =
            typeof data?.message === "string" && data.message.trim()
              ? data.message.trim()
              : typeof data?.error === "string" && data.error.trim()
                ? data.error.trim()
                : null;
          setActionMessage(
            data?.refunded
              ? t.creator.generateFailedRefunded
              : serverMessage || t.creator.generateFailed
          );
          if (typeof data?.creditsAfter === "number") {
            applyServerCredits(data.creditsAfter);
          } else if (data?.refunded) {
            await refreshAccount();
          }
          setRegenerateBusy(false);
          setRegeneratingSlot(null);
          return;
        }
        nextUrl = data.imageUrls[0];
        serverDebited = Boolean(data.ledgerId);
        if (typeof data.creditsAfter === "number") {
          applyServerCredits(data.creditsAfter);
        } else if (serverDebited) {
          await refreshAccount();
        }
      } catch (err) {
        console.error("[PersonaCreator] regenerate unexpected error", err);
        setActionMessage(t.creator.generateNetworkError);
        setRegenerateBusy(false);
        setRegeneratingSlot(null);
        return;
      }

      if (!serverDebited) {
        const spend = await apiFetchJson<{
          creditsAfter?: number;
          ledgerId?: string | null;
        }>("/api/credits/spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: REGENERATE_CREDIT_COST,
            reason: "regenerate",
            meta: { portraitSlot: id },
          }),
        });
        if (spend.status === 402) {
          setShowCreditModal(true);
          setRegenerateBusy(false);
          setRegeneratingSlot(null);
          return;
        }
        if (spend.ok && typeof spend.data?.creditsAfter === "number") {
          applyServerCredits(spend.data.creditsAfter);
        } else if (!consumeCredit(REGENERATE_CREDIT_COST)) {
          setShowCreditModal(true);
          setRegenerateBusy(false);
          setRegeneratingSlot(null);
          return;
        }
        const debitResult = requestRetouch(id, "regenerate", { skipCredit: true });
        if (!debitResult.ok) {
          setRegenerateBusy(false);
          setRegeneratingSlot(null);
          if (debitResult.reason === "throttle") setActionMessage(t.creator.retouchThrottle);
          else if (debitResult.reason === "daily_limit") setActionMessage(t.creator.retouchDailyLimit);
          else if (debitResult.reason === "insufficient_credits") setShowCreditModal(true);
          return;
        }
      } else {
        // Keep retouch bookkeeping in sync when /api/generate already billed.
        requestRetouch(id, "regenerate", { skipCredit: true });
      }

      if (!nextUrl) {
        setRegenerateBusy(false);
        setRegeneratingSlot(null);
        return;
      }

      const nextDrafts = [drafts[0] || "", drafts[1] || ""];
      nextDrafts[targetSlot] = nextUrl;
      setFocusedDraft(targetSlot);
      setDrafts(nextDrafts);
      setDraftImagePans((prev) => {
        const next: [ImagePan, ImagePan] = [
          { ...prev[0] },
          { ...prev[1] },
        ];
        next[targetSlot] = { ...DEFAULT_IMAGE_PAN };
        return next;
      });
      setSelectedResultUrl(nextUrl);
      setDraftRevision((n) => n + 1);
      void snapshotConfirmedImage(nextUrl);
      saveResultSession({
        drafts: nextDrafts,
        focusedDraft: targetSlot,
        selectedResultUrl: nextUrl,
        resultView,
        resultReady: true,
        portraitId: pid,
        directEditMode: false,
      });
      setActionMessage(t.creator.regenerateDone);
      showToast(t.creator.regenerateDone, "success");
      setRegenerateBusy(false);
      setRegeneratingSlot(null);

      try {
        const uploaded = await uploadGalleryAsset(nextUrl, `${pid}-${targetSlot}`, planId);
        const durable = uploaded?.imageUrl || uploaded?.thumbnailUrl || nextUrl;
        const meta = getAccountMeta();
        const retentionCtx = retentionContextFromAccount(planId, meta);
        await pushGalleryHistoryAndSync(
          {
            id: `${pid}-${targetSlot}`,
            imageUrl: durable,
            thumbnailUrl: uploaded?.thumbnailUrl,
            originalKey: uploaded?.originalKey,
            storageId: uploaded?.storageId ?? `${pid}-${targetSlot}`,
            createdAt: Date.now(),
            styleId: selectedStyles[0],
            profileId: selectedProfileId ?? undefined,
            profileName: selectedProfileId
              ? getFaceProfile(selectedProfileId)?.name
              : undefined,
            selfieUrls: resolveSelfieSourcesForGenerate({
              uploadedFiles,
              selectedProfileId,
            }).slice(0, 10),
          },
          retentionCtx
        );
        if (durable && durable !== nextUrl) {
          const durableDrafts = [...nextDrafts];
          durableDrafts[targetSlot] = durable;
          setDrafts(durableDrafts);
          setSelectedResultUrl((prev) => (prev === nextUrl ? durable : prev));
          void snapshotConfirmedImage(durable);
          saveResultSession({
            drafts: durableDrafts,
            focusedDraft: targetSlot,
            selectedResultUrl: durable,
            resultView,
            resultReady: true,
            portraitId: pid,
            directEditMode: false,
          });
          setDraftRevision((n) => n + 1);
        }
      } catch (err) {
        console.error("[PersonaCreator] regenerate gallery persist failed", err);
      }
    })();
  };

  /** Detail view: AI background keyword → full face+style+scene fusion re-render (not paste). */
  const handleBackgroundFusion = useCallback(
    async (keyword: string) => {
      const trimmed = keyword.trim();
      if (!trimmed) {
        throw new Error("키워드를 입력해 주세요.");
      }
      if (directEditMode) {
        throw new Error(t.creator.generateFailed);
      }
      if (regenerateBusy) {
        throw new Error(t.creator.regenerateBusyLabel);
      }

      const targetSlot: 0 | 1 = focusedDraft === 1 ? 1 : 0;
      const sourceDraft =
        drafts[targetSlot] ||
        selectedResultUrl ||
        confirmedImageUrl ||
        drafts[0] ||
        "";
      if (!sourceDraft.trim()) {
        throw new Error(t.creator.regenerateNeedDraft);
      }

      const selfieSources = resolveSelfieSourcesForGenerate({
        uploadedFiles,
        selectedProfileId,
        excludeUrls: [sourceDraft],
        draftFallback: sourceDraft,
      });
      if (selfieSources.length < 1) {
        throw new Error(t.creator.bgFusionNeedSelfies);
      }

      if (!unlimitedCredits && credits < REGENERATE_CREDIT_COST) {
        setShowCreditModal(true);
        throw new Error(t.creator.regenerateNeedCredit);
      }

      const pid = portraitId || `portrait-${Date.now()}`;
      if (!portraitId) {
        setPortraitId(pid);
        registerPortrait(`${pid}-0`);
        registerPortrait(`${pid}-1`);
      }

      setRegenerateBusy(true);
      setRegeneratingSlot(targetSlot);
      setActionMessage(null);

      console.info("[PersonaCreator] bg-fusion start", {
        keyword: trimmed,
        targetSlot,
        selfieCount: selfieSources.length,
        draftPreview: sourceDraft.slice(0, 96),
        profileId: selectedProfileId,
      });

      try {
        const { prompt: fusionPrompt, backgroundScene } = buildFusionPromptForApi({
          keywordOverride: trimmed,
        });

        const { imageUrl: nextUrl, creditsAfter, ledgerId } =
          await runBackgroundFusionGenerate({
            keyword: trimmed,
            selfieSources,
            sourceDraft,
            aspectRatio: draftAspectRatios[targetSlot] ?? aspectRatio,
            styleIds: selectedStyles,
            fusionPrompt,
            backgroundScene,
            additionalPrompt: prompt.trim() || undefined,
            userMessages: {
              missingSelfies: t.creator.bgFusionNeedSelfies,
              missingDraft: t.creator.regenerateNeedDraft,
            },
          });

        if (typeof creditsAfter === "number") {
          applyServerCredits(creditsAfter);
        } else if (ledgerId) {
          await refreshAccount();
        } else if (!consumeCredit(REGENERATE_CREDIT_COST)) {
          setShowCreditModal(true);
        }

        const nextDrafts: [string, string] = [drafts[0] || "", drafts[1] || ""];
        nextDrafts[targetSlot] = nextUrl;
        setFocusedDraft(targetSlot);
        setDrafts(nextDrafts);
        setDraftImagePans((prev) => {
          const next: [ImagePan, ImagePan] = [{ ...prev[0] }, { ...prev[1] }];
          next[targetSlot] = { ...DEFAULT_IMAGE_PAN };
          return next;
        });
        setSelectedResultUrl(nextUrl);
        setDraftRevision((n) => n + 1);
        void snapshotConfirmedImage(nextUrl);
        persistResultSession({
          drafts: nextDrafts,
          focusedDraft: targetSlot,
          selectedResultUrl: nextUrl,
          resultView,
          resultReady: true,
          portraitId: pid,
          directEditMode: false,
          selfieUrls: selfieSources,
          profileId: selectedProfileId,
        });
        setActionMessage(t.creator.regenerateDone);
        showToast(t.creator.regenerateDone, "success");
        console.info("[PersonaCreator] bg-fusion success", {
          targetSlot,
          imageHost: (() => {
            try {
              return new URL(nextUrl).host;
            } catch {
              return "inline";
            }
          })(),
        });
      } catch (err) {
        const message =
          err instanceof BackgroundFusionError
            ? err.message
            : err instanceof Error
              ? err.message
              : t.creator.generateFailed;
        console.error("[PersonaCreator] bg-fusion failed", err);
        setActionMessage(message);
        showToast(message, "error");
        if (err instanceof BackgroundFusionError && err.code === "insufficient_credits") {
          setShowCreditModal(true);
        }
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setRegenerateBusy(false);
        setRegeneratingSlot(null);
      }
    },
    [
      aspectRatio,
      applyServerCredits,
      buildFusionPromptForApi,
      consumeCredit,
      confirmedImageUrl,
      credits,
      directEditMode,
      draftAspectRatios,
      drafts,
      focusedDraft,
      persistResultSession,
      portraitId,
      refreshAccount,
      registerPortrait,
      regenerateBusy,
      resultView,
      selectedResultUrl,
      selectedProfileId,
      selectedStyles,
      setShowCreditModal,
      showToast,
      snapshotConfirmedImage,
      t.creator.bgFusionNeedSelfies,
      t.creator.generateFailed,
      t.creator.generateNetworkError,
      t.creator.regenerateBusyLabel,
      t.creator.regenerateDone,
      t.creator.regenerateNeedCredit,
      t.creator.regenerateNeedDraft,
      unlimitedCredits,
      uploadedFiles,
    ]
  );

  const resolveSelectedImageUrl = () =>
    selectedResultUrl ||
    confirmedImageUrl ||
    drafts[focusedDraft] ||
    focusedImageUrl ||
    directEditImageUrl ||
    "";

  const handleExportDownload = async (preset: DownloadQuality) => {
    if (isDownloading) return;
    const imageUrl = resolveSelectedImageUrl();
    if (!imageUrl) {
      showToast(t.creator.downloadFailed, "error");
      return;
    }
    if (!unlimitedCredits && credits < DOWNLOAD_CREDIT_COST) {
      setShowCreditModal(true);
      return;
    }

    const activeAspect = draftAspectRatios[focusedDraft] ?? aspectRatio;
    const activePan = draftImagePans[focusedDraft] ?? DEFAULT_IMAGE_PAN;
    setIsDownloading(true);
    if (preset !== "hd") setExportPreset(preset);

    let serverSpent = false;
    try {
      const spend = await apiFetchJson<{
        creditsAfter?: number;
        ledgerId?: string | null;
        error?: string;
      }>("/api/credits/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: DOWNLOAD_CREDIT_COST,
          reason: "download",
          meta: { preset, portraitId: portraitId ?? null },
        }),
      });

      if (spend.status === 402) {
        setShowCreditModal(true);
        return;
      }
      if (spend.ok && typeof spend.data?.creditsAfter === "number") {
        applyServerCredits(spend.data.creditsAfter);
        serverSpent = Boolean(spend.data.ledgerId);
      } else if (!spend.ok) {
        // Fall back to local wallet when spend API is unavailable (offline / promo).
        if (!consumeCredit(DOWNLOAD_CREDIT_COST)) {
          setShowCreditModal(true);
          return;
        }
      } else if (!consumeCredit(DOWNLOAD_CREDIT_COST)) {
        setShowCreditModal(true);
        return;
      }

      await downloadImageFile({
        imageUrl,
        filename:
          preset === "id-photo"
            ? `studio-canvas-id-photo-${Date.now()}.png`
            : preset === "print-png"
              ? `studio-canvas-print-a4-300dpi-${Date.now()}.png`
              : preset === "print-pdf"
                ? `studio-canvas-print-a4-300dpi-${Date.now()}.pdf`
                : preset === "original"
                  ? `studio-canvas-original-${Date.now()}.png`
                  : `studio-canvas-hd-${Date.now()}.png`,
        bakeWatermark:
          applyBrandWatermark && preset !== "print-png" && preset !== "print-pdf",
        aspectRatio: preset === "id-photo" ? "id" : activeAspect,
        exportPreset: preset,
        printPaper: "a4",
        imagePan: activePan,
      });
      // Download success → also register in My Gallery (no separate save click).
      handleSaveToGallery();
    } catch (err) {
      console.error("[PersonaCreator] download failed", err);
      showToast(t.creator.downloadFailed, "error");
      // Best-effort: if file export failed after a server spend, leave debit
      // (file may have partially written); client-only spend cannot refund easily.
      void serverSpent;
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveToGallery = () => {
    const urls = Array.from(
      new Set(
        [resolveSelectedImageUrl(), ...drafts].filter(
          (url): url is string => typeof url === "string" && url.trim().length > 8
        )
      )
    );
    if (urls.length < 1) {
      showToast(t.creator.downloadFailed, "error");
      return;
    }
    const existing = listGalleryHistory();
    const missing = urls.filter((url) => !existing.some((item) => item.imageUrl === url));
    const retentionCtx = retentionContextFromAccount(planId, getAccountMeta());
    const now = Date.now();
    missing.forEach((url, idx) => {
      const id = `${portraitId ?? "photo"}-save-${now}-${idx}`;
      void pushGalleryHistoryAndSync(
        {
          id,
          imageUrl: url,
          storageId: id,
          createdAt: now + idx,
          styleId: selectedStyles[0],
          profileId: selectedProfileId ?? undefined,
          profileName: selectedProfileId
            ? getFaceProfile(selectedProfileId)?.name
            : undefined,
          selfieUrls: resolveSelfieSourcesForGenerate({
            uploadedFiles,
            selectedProfileId,
          }).slice(0, 10),
        },
        retentionCtx
      );
    });
    setGallerySavedMsg(true);
    showToast(t.creator.savedToGallery, "success");
  };

  const handleRetryWithAnotherStyle = () => {
    clearResultSession();
    clearConfirmedImage();
    setResultReady(false);
    setResultView("compare");
    setDrafts([]);
    setSelectedResultUrl("");
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
    clearResultSession();
    clearConfirmedImage();
    setResultReady(false);
    setResultView("compare");
    setDrafts([]);
    setSelectedResultUrl("");
    setPortraitId(null);
    setGallerySavedMsg(false);
    setActionMessage(null);
    showToast(t.creator.deletePortraitDone, "success");
  };

  const handleShare = async () => {
    const imageUrl = resolveSelectedImageUrl();
    const pageUrl = typeof window !== "undefined" ? window.location.href : "";
    try {
      let file: File | null = null;
      if (imageUrl) {
        const res = await fetch(resolveCanvasImageUrl(imageUrl), {
          credentials: "same-origin",
        });
        if (res.ok) {
          const blob = await res.blob();
          file = new File([blob], `studio-canvas-${Date.now()}.png`, {
            type: blob.type || "image/png",
          });
        }
      }

      const publicImageUrl = null;

      try {
        const mode = await shareImageViaKakao({
          file,
          publicImageUrl,
          title: "Studio Canvas AI",
          description: t.thumbnail.shareText,
          linkUrl: KAKAO_REGISTERED_ORIGIN,
          buttonTitle: t.thumbnail.kakaoShareOpen,
        });
        if (mode === "kakao") return;
      } catch (err) {
        console.warn("[PersonaCreator] Kakao Share failed", err);
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
        if (pageUrl) {
          await navigator.clipboard.writeText(pageUrl);
          showToast(t.creator.shareCopied, "success");
        }
      } catch {
        showToast(t.thumbnail.shareFailed, "error");
      }
    }
  };

  const loadSavedProfile = (profile: FaceProfile) => {
    setSelectedProfileId(profile.id);
    const merged = mergePhotoUrls(
      uploadedFiles,
      profile.photoUrls,
      MAX_SELFIE_UPLOADS
    );
    const newUnique = profile.photoUrls.filter(
      (url) => url?.trim() && !uploadedFiles.includes(url.trim())
    );
    const added = merged.length - uploadedFiles.length;
    setUploadedFiles(merged);
    if (newUnique.length > added) {
      setValidationError(
        fillCanvas(t.creator.uploadLimitFull, { max: MAX_SELFIE_UPLOADS })
      );
    } else {
      setValidationError(null);
    }
    setProfileMenuOpen(false);
  };

  const uploadStepTitle = isPerson ? t.creator.uploadTitlePerson : t.creator.uploadTitleObject;

  const standardDetailRaw =
    selectedResultUrl ||
    confirmedImageUrl ||
    drafts[focusedDraft] ||
    focusedImageUrl ||
    directEditImageUrl;

  return (
    <section id="creator" className="section-padding relative">
      <div className="ambient-glow top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 bg-glow-purple/10" />

      <div className="relative mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{t.creator.title}</h2>
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
                      className={`text-xs font-semibold leading-tight ${isActive ? "text-white" : "text-white/45"}`}
                    >
                      {step.title}
                    </div>
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

        <div ref={stepContentRef} className="overflow-visible rounded-3xl bg-white/[0.03] p-5 pb-12 sm:p-8 sm:pb-14">
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
            <div className="animate-fade-in space-y-8">
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

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visiblePacks.map((pack) => {
                  const meta = t.styles.packs[pack.id as keyof typeof t.styles.packs];
                  if (!meta) return null;
                  const isSelected = selectedStyles.includes(pack.id);
                  return (
                    <div
                      key={pack.id}
                      className={`group flex flex-col overflow-hidden rounded-2xl bg-white/[0.03] transition-all duration-300 ${
                        isSelected ? "ring-2 ring-glow-purple/60" : "hover:bg-white/[0.05]"
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
                        {isSelected && (
                          <span className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-glow-purple text-white">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </button>

                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <h4 className="text-sm font-semibold text-white">{meta.name}</h4>
                        <button
                          type="button"
                          onClick={() => chooseStyleAndContinue(pack.id)}
                          className="btn-primary mt-auto w-full justify-center py-2.5 text-sm font-bold"
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
              <div>
                <h3 className="mb-4 text-sm font-medium tracking-wider text-white/45 uppercase">
                  {t.creator.subject}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {subjectTypeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectSubject(option.id)}
                      className={`rounded-2xl p-4 text-center transition-all duration-300 ${
                        subject === option.id
                          ? "bg-glow-purple/15 ring-1 ring-glow-purple/40"
                          : "bg-white/[0.03] hover:bg-white/[0.06]"
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
                  <h3 className="mb-3 text-sm font-medium tracking-wider text-white/45 uppercase">
                    {t.creator.age}
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {ageOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setAge(option.id);
                          setValidationError(null);
                        }}
                        className={`rounded-2xl p-3 text-center transition-all duration-300 sm:p-4 ${
                          age === option.id
                            ? "bg-glow-purple/15 ring-1 ring-glow-purple/40"
                            : "bg-white/[0.03] hover:bg-white/[0.06]"
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
                className={`relative rounded-2xl p-6 text-center transition-all duration-300 sm:p-8 ${
                  isDragOver ? "bg-glow-purple/10 ring-1 ring-glow-purple/40" : "bg-white/[0.03]"
                } ${uploadedFiles.length >= MAX_SELFIE_UPLOADS ? "opacity-60" : ""}`}
                onDragOver={(e) => {
                  if (uploadedFiles.length >= MAX_SELFIE_UPLOADS) return;
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
              >
                <ImagePlus className="mx-auto mb-4 h-10 w-10 text-white/30" />
                <p className="mb-1 text-sm font-medium text-white/70">{uploadStepTitle}</p>
                <p className="text-xs leading-relaxed text-white/40">
                  {uploadedFiles.length >= MAX_SELFIE_UPLOADS
                    ? fillCanvas(t.creator.uploadLimitFull, { max: MAX_SELFIE_UPLOADS })
                    : t.creator.uploadHint}
                </p>
                {isUploading && (
                  <p className="mt-3 text-xs text-glow-purple">{t.creator.uploadProcessing}</p>
                )}
                <input
                  type="file"
                  multiple
                  accept={ACCEPT_ATTR}
                  disabled={isUploading || uploadedFiles.length >= MAX_SELFIE_UPLOADS}
                  className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  onChange={(e) => {
                    void ingestFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
              </div>

              <SoftAccordion label={t.creator.uploadGuide}>
                <p className="text-xs leading-relaxed text-white/45">{t.creator.uploadFormatHint}</p>
                {isPerson && (
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    {t.creator.uploadIdentityHint}
                  </p>
                )}
              </SoftAccordion>

              <div className="flex items-center gap-3">
                <span className="shrink-0 text-xs text-white/50 sm:text-sm">
                  {t.creator.uploadCount.replace("{count}", String(uploadedFiles.length))}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-glow-purple to-glow-emerald transition-all duration-500"
                    style={{
                      width: `${(uploadedFiles.length / MAX_SELFIE_UPLOADS) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {uploadedFiles.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
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
                  {Array.from({
                    length: Math.max(0, MAX_SELFIE_UPLOADS - uploadedFiles.length),
                  }).map((_, idx) => (
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

          {!isTraining && currentStep === 4 && resultReady && resultView === "compare" && !directEditMode && (
            <div className="animate-fade-in space-y-6 pb-8">
              <div className="text-center">
                <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
                  {t.creator.comparePhaseTitle}
                </h3>
                <p className="mx-auto mt-1 max-w-lg text-sm text-white/50">
                  {t.creator.comparePhaseSubtitle}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {([0, 1] as const).map((idx) => {
                  const url = drafts[idx] || drafts[0] || "";
                  if (!url) return null;
                  return (
                    <div key={`compare-${idx}`} className="space-y-3">
                      <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="aspect-[3/4] w-full object-cover" />
                        <div className="absolute top-2 left-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
                          {idx === 0 ? t.creator.draftA : t.creator.draftB}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => confirmDraftAndGoToEdit(idx)}
                        className="btn-primary w-full py-3 text-sm font-bold"
                      >
                        {t.creator.confirmDraftSelect.replace(
                          "{draft}",
                          idx === 0 ? t.creator.draftA : t.creator.draftB
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isTraining && currentStep === 5 && resultReady && (
            <ResultWorkspace
              variant={directEditMode ? "photo" : "ai"}
              drafts={drafts}
              focusedDraft={focusedDraft}
              onFocusDraft={focusDraft}
              draftAspectRatios={draftAspectRatios}
              onDraftAspectRatioChange={(idx, key) => {
                setDraftAspectRatios((prev) => {
                  const next: [AspectRatioKey, AspectRatioKey] = [prev[0], prev[1]];
                  next[idx] = key;
                  return next;
                });
                if (idx === focusedDraft) setAspectRatio(key);
              }}
              draftImagePans={draftImagePans}
              onDraftImagePanChange={(idx, pan) => {
                setDraftImagePans((prev) => {
                  const next: [ImagePan, ImagePan] = [
                    { ...prev[0] },
                    { ...prev[1] },
                  ];
                  next[idx] = pan;
                  return next;
                });
              }}
              selectedRawUrl={standardDetailRaw}
              draftRevision={draftRevision}
              regeneratingSlot={regeneratingSlot}
              isDownloading={isDownloading}
              isGenerating={isGenerating}
              regenerateBusy={regenerateBusy}
              onExportDownload={(preset) => void handleExportDownload(preset)}
              onDelete={directEditMode ? undefined : () => void handleDeletePortrait()}
              prompt={prompt}
              onPromptChange={setPrompt}
              onRegenerate={handleRegenerate}
              creditsLabel={creditsLabel}
              unlimitedCredits={unlimitedCredits}
              credits={credits}
              maxCredits={maxCredits}
              actionMessage={actionMessage}
              gallerySavedMsg={gallerySavedMsg}
              showBrandWatermark={applyBrandWatermark}
              directEditSource={directEditSource}
              profileId={selectedProfileId}
              profileName={
                selectedProfileId ? getFaceProfile(selectedProfileId)?.name ?? null : null
              }
              exportPreset={exportPreset}
              onGenerateBackgroundFusion={handleBackgroundFusion}
            />
          )}

          {!isTraining && currentStep === 4 && !resultReady && (
            <div className="animate-fade-in space-y-6 pb-8">
              <div className="text-center">
                <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
                  {t.creator.resultTitle}
                </h3>
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

              {!isGenerating && !generationError && (
                <div className="space-y-4">
                  <div
                    className={`relative mx-auto flex w-full max-w-sm flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center ${ASPECT_RATIO_CLASS[aspectRatio]}`}
                  >
                    {uploadedFiles[0] ? (
                      <img
                        src={uploadedFiles[0]}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-40"
                      />
                    ) : null}
                    <div className="relative z-10 flex flex-col items-center">
                      <Wand2 className="mb-3 h-8 w-8 text-white/70" />
                      <p className="text-sm text-white/70">{t.creator.promptPreviewLabel}</p>
                    </div>
                  </div>
                </div>
              )}

              {isGenerating && (
                <div
                  className={`relative mx-auto flex w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-white/10 ${ASPECT_RATIO_CLASS[aspectRatio]}`}
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

              {!isGenerating && (
                <>
                  <SoftAccordion label={t.creator.moreOptions}>
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <label className="text-sm font-medium text-white/70">{t.creator.promptLabel}</label>
                          <span className="text-[11px] text-white/40">
                            {t.creator.creditBadge
                              .replace("{current}", unlimitedCredits ? creditsLabel : String(credits))
                              .replace("{max}", unlimitedCredits ? creditsLabel : String(maxCredits))}
                          </span>
                        </div>
                        <textarea
                          value={prompt}
                          maxLength={PROMPT_MAX_LENGTH}
                          onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX_LENGTH))}
                          placeholder={t.creator.promptPlaceholder}
                          rows={3}
                          className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-300 focus:ring-1 focus:ring-glow-purple/40"
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-medium text-white/70">{t.creator.aspectRatioLabel}</p>
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              ["9:16", t.creator.aspect916],
                              ["16:9", t.creator.aspect169],
                              ["id", t.creator.aspectId],
                              ["a4", t.creator.aspectA4],
                            ] as const
                          ).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setAspectRatio(key)}
                              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                                aspectRatio === key
                                  ? "bg-glow-purple/15 text-white"
                                  : "bg-white/[0.04] text-white/45 hover:text-white/70"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SoftAccordion>

                  <button
                    type="button"
                    onClick={() =>
                      useTrainCredits || selectedProfileId
                        ? handleStartTraining({ train: true })
                        : handleGenerate()
                    }
                    disabled={
                      isGenerating ||
                      regenerateBusy ||
                      uploadedFiles.length < MIN_SELFIE_UPLOADS ||
                      selectedStyles.length < 1
                    }
                    className="btn-primary w-full py-3.5 text-sm font-bold disabled:opacity-50"
                  >
                    <Wand2 className={`h-4 w-4 shrink-0 ${regenerateBusy || isGenerating ? "animate-pulse" : ""}`} />
                    <span>
                      {useTrainCredits || selectedProfileId
                        ? t.profiles.train
                        : t.creator.generatePortrait}
                    </span>
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
            <div className="mt-10 flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => goToStep(Math.max(1, currentStep - 1))}
                className={`min-w-0 px-3 py-2 text-sm text-white/45 hover:text-white ${currentStep === 1 ? "invisible" : ""}`}
              >
                <span className="truncate">{t.creator.prev}</span>
              </button>

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="btn-primary min-w-0 px-6 py-3 text-sm font-bold"
                >
                  <span className="truncate">{t.creator.next}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goToStep(4)}
                  className="btn-primary min-w-0 px-6 py-3 text-sm font-bold"
                >
                  <span className="truncate">{t.creator.next}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              )}
            </div>
          )}

          {!isTraining && currentStep === 4 && !directEditMode && !resultReady && !isGenerating && (
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

          {!isTraining && currentStep === 4 && !directEditMode && (resultReady || isGenerating) && (
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

          {!isTraining && currentStep === 5 && (
            <div className="mt-6 flex justify-start border-t border-white/[0.06] pt-6">
              {directEditMode ? (
                <Link
                  href="/gallery/my?tab=models"
                  className="btn-secondary inline-flex min-w-0 items-center gap-2 px-4 py-2.5 text-sm"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t.creator.viewMyGallery}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleBackStep}
                  className="btn-secondary min-w-0 px-4 py-2.5 text-sm"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t.creator.prev}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
