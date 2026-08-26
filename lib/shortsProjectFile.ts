/**
 * Screen 13 (Shorts studio) editable project container (.sca / .json).
 * Sealed with the same site crypto as canvas projects (`exportSecureProject`).
 */

import {
  downloadBlobLocally,
} from "@/lib/canvas/projectFile";
import {
  exportSecureProjectBlob,
  importSecureProject,
  SCA_FILE_EXT,
} from "@/lib/projectStorage";
import {
  createDefaultShortsBgmState,
  clampBgmVolume,
  type ShortsBgmState,
} from "@/lib/shortsBgm";
import {
  DEFAULT_SHORTS_CAPTION_STYLE,
  type ShortsCaptionSegment,
  type ShortsCaptionStyle,
} from "@/lib/shortsCaptions";
import {
  SHORTS_VIDEO_POS_Y_DEFAULT,
  SHORTS_VIDEO_SCALE_DEFAULT,
  clampVideoPosY,
  clampVideoScale,
} from "@/lib/shortsFfmpegMix";
import type { ShortsHookFrame } from "@/lib/shortsHookShared";
import type { ShortsTextLayer } from "@/lib/shortsStudioExport";
import { createShortsTextLayer } from "@/lib/shortsStudioExport";
import type { ShortsStudioSession } from "@/lib/shortsStudioSession";
import type { ShortsStorageMode } from "@/lib/shortsVideo";

export const SHORTS_PROJECT_KIND = "studio-shorts-project" as const;
export const SHORTS_PROJECT_VERSION = 1 as const;
export const SHORTS_PROJECT_FILE_EXT = SCA_FILE_EXT;

export type ShortsStudioProjectMedia = {
  videoId: string | null;
  videoUrl: string | null;
  videoFileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string | null;
  storage: ShortsStorageMode | null;
  hookImageUrl: string | null;
  hook: ShortsHookFrame | null;
  fileName: string;
  playbackUrl: string | null;
};

export type ShortsStudioProjectEdit = {
  captions: ShortsCaptionSegment[];
  captionStyle: ShortsCaptionStyle;
  videoLayers: ShortsTextLayer[];
  thumbnailLayers: ShortsTextLayer[];
  bgm: ShortsBgmState;
  videoScale: number;
  videoPosY: number;
  bindThumbIntro: boolean;
};

export type ShortsStudioProjectV1 = {
  kind: typeof SHORTS_PROJECT_KIND;
  version: typeof SHORTS_PROJECT_VERSION;
  savedAt: number;
  label: string;
  media: ShortsStudioProjectMedia;
  edit: ShortsStudioProjectEdit;
};

/** Drop session-local blob/data URLs — they cannot be restored later. */
export function persistableUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return null;
  return trimmed;
}

function sanitizeBgm(bgm: ShortsBgmState): ShortsBgmState {
  return {
    bgmUrl: persistableUrl(bgm.bgmUrl),
    bgmName: typeof bgm.bgmName === "string" ? bgm.bgmName : "",
    bgmVolume: clampBgmVolume(bgm.bgmVolume),
  };
}

function projectLabelFromEdit(edit: ShortsStudioProjectEdit, savedAt: number): string {
  const fromCaption =
    edit.captions.find((c) => c.text?.trim())?.text?.trim() ||
    edit.videoLayers.find((l) => l.text?.trim())?.text?.trim() ||
    edit.thumbnailLayers.find((l) => l.text?.trim())?.text?.trim() ||
    "";
  const short = fromCaption.replace(/\s+/g, " ").slice(0, 28);
  const when = new Date(savedAt);
  const stamp = `${when.getMonth() + 1}/${when.getDate()} ${String(
    when.getHours()
  ).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  if (short) return `${short} · ${stamp}`;
  return `쇼츠 · ${stamp}`;
}

export type BuildShortsProjectInput = {
  session: ShortsStudioSession | null;
  videoId: string | null;
  videoUrl: string | null;
  videoFileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string | null;
  storage: ShortsStorageMode | null;
  captions: ShortsCaptionSegment[];
  captionStyle: ShortsCaptionStyle;
  videoLayers: ShortsTextLayer[];
  thumbnailLayers: ShortsTextLayer[];
  bgm: ShortsBgmState;
  videoScale: number;
  videoPosY: number;
  bindThumbIntro: boolean;
};

export function buildShortsStudioProject(
  input: BuildShortsProjectInput
): ShortsStudioProjectV1 {
  const savedAt = Date.now();
  const edit: ShortsStudioProjectEdit = {
    captions: JSON.parse(JSON.stringify(input.captions)) as ShortsCaptionSegment[],
    captionStyle: {
      ...DEFAULT_SHORTS_CAPTION_STYLE,
      ...input.captionStyle,
    },
    videoLayers: JSON.parse(
      JSON.stringify(input.videoLayers)
    ) as ShortsTextLayer[],
    thumbnailLayers: JSON.parse(
      JSON.stringify(input.thumbnailLayers)
    ) as ShortsTextLayer[],
    bgm: sanitizeBgm(input.bgm),
    videoScale: clampVideoScale(input.videoScale),
    videoPosY: clampVideoPosY(input.videoPosY),
    bindThumbIntro: Boolean(input.bindThumbIntro),
  };

  const hook = input.session?.hook ?? null;
  const media: ShortsStudioProjectMedia = {
    videoId: input.videoId || input.session?.videoId || null,
    videoUrl:
      persistableUrl(input.videoUrl) ||
      persistableUrl(input.session?.videoUrl) ||
      persistableUrl(input.session?.playbackUrl),
    videoFileName:
      input.videoFileName ||
      input.session?.videoFileName ||
      input.session?.fileName ||
      "",
    contentType:
      input.contentType || input.session?.contentType || "video/mp4",
    sizeBytes: input.sizeBytes || input.session?.sizeBytes || 0,
    storageKey: input.storageKey ?? input.session?.storageKey ?? null,
    storage: input.storage ?? input.session?.storage ?? null,
    hookImageUrl: persistableUrl(hook?.imageUrl),
    hook: hook
      ? ({
          ...hook,
          imageUrl: persistableUrl(hook.imageUrl) || hook.imageUrl,
        } as ShortsHookFrame)
      : null,
    fileName: input.session?.fileName || input.videoFileName || "",
    playbackUrl:
      persistableUrl(input.session?.playbackUrl) ||
      persistableUrl(input.videoUrl),
  };

  return {
    kind: SHORTS_PROJECT_KIND,
    version: SHORTS_PROJECT_VERSION,
    savedAt,
    label: projectLabelFromEdit(edit, savedAt),
    media,
    edit,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Validate + normalize raw JSON (after unseal). */
export function parseShortsStudioProject(raw: unknown): ShortsStudioProjectV1 {
  if (!isRecord(raw)) throw new Error("invalid_shorts_project");
  if (raw.kind !== SHORTS_PROJECT_KIND) {
    throw new Error("not_shorts_project");
  }
  if (raw.version !== 1) throw new Error("unsupported_shorts_project_version");

  const editRaw = isRecord(raw.edit) ? raw.edit : {};
  const mediaRaw = isRecord(raw.media) ? raw.media : {};

  const captions = Array.isArray(editRaw.captions)
    ? (editRaw.captions as ShortsCaptionSegment[])
    : [];
  const videoLayers = Array.isArray(editRaw.videoLayers)
    ? (editRaw.videoLayers as ShortsTextLayer[])
    : [createShortsTextLayer({ text: "", y: 0.22 })];
  const thumbnailLayers = Array.isArray(editRaw.thumbnailLayers)
    ? (editRaw.thumbnailLayers as ShortsTextLayer[])
    : [createShortsTextLayer({ text: "", y: 0.78 })];

  const bgmRaw = isRecord(editRaw.bgm) ? editRaw.bgm : {};
  const bgm: ShortsBgmState = sanitizeBgm({
    bgmUrl: typeof bgmRaw.bgmUrl === "string" ? bgmRaw.bgmUrl : null,
    bgmName: typeof bgmRaw.bgmName === "string" ? bgmRaw.bgmName : "",
    bgmVolume:
      typeof bgmRaw.bgmVolume === "number"
        ? bgmRaw.bgmVolume
        : createDefaultShortsBgmState().bgmVolume,
  });

  const captionStyle = {
    ...DEFAULT_SHORTS_CAPTION_STYLE,
    ...(isRecord(editRaw.captionStyle)
      ? (editRaw.captionStyle as Partial<ShortsCaptionStyle>)
      : {}),
  } as ShortsCaptionStyle;

  const edit: ShortsStudioProjectEdit = {
    captions,
    captionStyle,
    videoLayers: videoLayers.length
      ? videoLayers
      : [createShortsTextLayer({ text: "", y: 0.22 })],
    thumbnailLayers: thumbnailLayers.length
      ? thumbnailLayers
      : [createShortsTextLayer({ text: "", y: 0.78 })],
    bgm,
    videoScale: clampVideoScale(
      typeof editRaw.videoScale === "number"
        ? editRaw.videoScale
        : SHORTS_VIDEO_SCALE_DEFAULT
    ),
    videoPosY: clampVideoPosY(
      typeof editRaw.videoPosY === "number"
        ? editRaw.videoPosY
        : SHORTS_VIDEO_POS_Y_DEFAULT
    ),
    bindThumbIntro: editRaw.bindThumbIntro !== false,
  };

  const hook =
    isRecord(mediaRaw.hook) && typeof mediaRaw.hook.imageUrl === "string"
      ? (mediaRaw.hook as ShortsHookFrame)
      : null;

  const media: ShortsStudioProjectMedia = {
    videoId: typeof mediaRaw.videoId === "string" ? mediaRaw.videoId : null,
    videoUrl: persistableUrl(
      typeof mediaRaw.videoUrl === "string" ? mediaRaw.videoUrl : null
    ),
    videoFileName:
      typeof mediaRaw.videoFileName === "string" ? mediaRaw.videoFileName : "",
    contentType:
      typeof mediaRaw.contentType === "string"
        ? mediaRaw.contentType
        : "video/mp4",
    sizeBytes: typeof mediaRaw.sizeBytes === "number" ? mediaRaw.sizeBytes : 0,
    storageKey:
      typeof mediaRaw.storageKey === "string" ? mediaRaw.storageKey : null,
    storage:
      mediaRaw.storage === "r2" || mediaRaw.storage === "local"
        ? mediaRaw.storage
        : null,
    hookImageUrl: persistableUrl(
      typeof mediaRaw.hookImageUrl === "string"
        ? mediaRaw.hookImageUrl
        : hook?.imageUrl
    ),
    hook,
    fileName: typeof mediaRaw.fileName === "string" ? mediaRaw.fileName : "",
    playbackUrl: persistableUrl(
      typeof mediaRaw.playbackUrl === "string" ? mediaRaw.playbackUrl : null
    ),
  };

  const savedAt =
    typeof raw.savedAt === "number" && Number.isFinite(raw.savedAt)
      ? raw.savedAt
      : Date.now();
  const label =
    typeof raw.label === "string" && raw.label.trim()
      ? raw.label.trim()
      : projectLabelFromEdit(edit, savedAt);

  return {
    kind: SHORTS_PROJECT_KIND,
    version: SHORTS_PROJECT_VERSION,
    savedAt,
    label,
    media,
    edit,
  };
}

export async function readShortsProjectFile(
  file: File
): Promise<ShortsStudioProjectV1> {
  const raw = await importSecureProject(file);
  try {
    return parseShortsStudioProject(raw);
  } catch (err) {
    if (err instanceof Error && err.message === "not_shorts_project") {
      throw new Error("not_shorts_project");
    }
    throw new Error("invalid_or_tampered_project");
  }
}

/** Download sealed Shorts `.sca` project file. */
export async function downloadShortsProjectLocally(
  project: ShortsStudioProjectV1,
  baseName: string
): Promise<void> {
  const stamp = Date.now();
  const base = baseName.replace(/[^\w.-]+/g, "_") || "shorts-project";
  const blob = await exportSecureProjectBlob(project);
  downloadBlobLocally(blob, `${base}-${stamp}${SHORTS_PROJECT_FILE_EXT}`);
}

/** MP4 + sealed project back-to-back (Screen 10 parity). */
export async function downloadVideoAndShortsProjectLocally(opts: {
  videoBlob: Blob;
  project: ShortsStudioProjectV1;
  baseName: string;
  videoFileName?: string;
}): Promise<void> {
  const stamp = Date.now();
  const base = opts.baseName.replace(/[^\w.-]+/g, "_") || "shorts";
  const mp4Name = opts.videoFileName || `${base}-${stamp}.mp4`;
  downloadBlobLocally(opts.videoBlob, mp4Name);
  await new Promise((r) => setTimeout(r, 180));
  const projectBlob = await exportSecureProjectBlob(opts.project);
  downloadBlobLocally(projectBlob, `${base}-${stamp}${SHORTS_PROJECT_FILE_EXT}`);
}

/** Placeholder 9:16 still when a project has no hook thumbnail URL. */
const RESTORED_HOOK_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><rect fill="#111827" width="100%" height="100%"/><text x="50%" y="50%" fill="#6b7280" font-size="36" text-anchor="middle" dominant-baseline="middle">Shorts</text></svg>`
  );

/** Build a ShortsStudioSession so the dual studio can open after restore. */
export function sessionFromShortsProject(
  project: ShortsStudioProjectV1
): ShortsStudioSession {
  const { media } = project;
  const hook: ShortsHookFrame =
    media.hook && media.hook.imageUrl
      ? media.hook
      : {
          id: "restored",
          index: 0,
          timestampSec: 0,
          score: 0,
          imageUrl: media.hookImageUrl || RESTORED_HOOK_PLACEHOLDER,
          storageKey: null,
        };
  return {
    videoId: media.videoId || `restored_${project.savedAt}`,
    fileName: media.fileName || media.videoFileName || "shorts.mp4",
    sizeBytes: media.sizeBytes,
    contentType: media.contentType || "video/mp4",
    storageKey: media.storageKey,
    playbackUrl: media.playbackUrl || media.videoUrl,
    videoUrl: media.videoUrl || media.playbackUrl,
    videoFileName: media.videoFileName || media.fileName,
    storage: media.storage || "local",
    hook,
    savedAt: Date.now(),
  };
}
