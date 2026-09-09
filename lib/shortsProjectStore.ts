"use client";

/**
 * Global Shorts project state — survives /shorts → /shorts/studio navigation.
 * Metadata in zustand (+ sessionStorage handoff); video bytes in IndexedDB.
 */

import { create } from "zustand";
import { createDefaultShortsBgmState, clampBgmVolume } from "@/lib/shortsBgm";
import type { ShortsStorageMode, ShortsVideoAsset } from "@/lib/shortsVideo";
import {
  deleteShortsVideoBlob,
  loadShortsVideoBlob,
  persistShortsVideoBlob,
} from "@/lib/shortsVideoIdb";

export type ShortsProjectState = {
  videoId: string | null;
  /** Playable / fetchable URL (R2 playback or local object URL). */
  videoUrl: string | null;
  videoFileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string | null;
  storage: ShortsStorageMode | null;
  bgmUrl: string | null;
  bgmName: string;
  bgmVolume: number;
  /** Last mixed output object URL (revoked on clear / new mix). */
  mixedVideoUrl: string | null;
  hydrateFromAsset: (asset: ShortsVideoAsset, file?: File | Blob | null) => Promise<void>;
  setBgm: ( partial: {
    bgmUrl?: string | null;
    bgmName?: string;
    bgmVolume?: number;
  }) => void;
  setMixedVideoUrl: (url: string | null) => void;
  /** Resolve a Blob for FFmpeg — prefers IDB, then fetch(videoUrl). */
  resolveVideoBlob: () => Promise<Blob>;
  clearProject: () => Promise<void>;
};

export const useShortsProjectStore = create<ShortsProjectState>((set, get) => ({
  videoId: null,
  videoUrl: null,
  videoFileName: "",
  contentType: "video/mp4",
  sizeBytes: 0,
  storageKey: null,
  storage: null,
  ...createDefaultShortsBgmState(),
  mixedVideoUrl: null,

  hydrateFromAsset: async (asset, file) => {
    const prev = get().mixedVideoUrl;
    if (prev) URL.revokeObjectURL(prev);

    const videoUrl = asset.playbackUrl || asset.previewUrl || null;
    set({
      videoId: asset.videoId,
      videoUrl,
      videoFileName: asset.fileName,
      contentType: asset.contentType || "video/mp4",
      sizeBytes: asset.sizeBytes,
      storageKey: asset.storageKey,
      storage: asset.storage,
      mixedVideoUrl: null,
    });

    if (file) {
      try {
        await persistShortsVideoBlob(asset.videoId, file, {
          fileName: asset.fileName,
          contentType: asset.contentType || "video/mp4",
        });
      } catch (err) {
        console.warn("[shorts/store] idb persist failed", err);
      }
    }
  },

  setBgm: (partial) => {
    set((s) => ({
      bgmUrl: partial.bgmUrl !== undefined ? partial.bgmUrl : s.bgmUrl,
      bgmName: partial.bgmName !== undefined ? partial.bgmName : s.bgmName,
      bgmVolume:
        partial.bgmVolume !== undefined
          ? clampBgmVolume(partial.bgmVolume)
          : s.bgmVolume,
    }));
  },

  setMixedVideoUrl: (url) => {
    const prev = get().mixedVideoUrl;
    if (prev && prev !== url) URL.revokeObjectURL(prev);
    set({ mixedVideoUrl: url });
  },

  resolveVideoBlob: async () => {
    const { videoId, videoUrl, contentType } = get();
    if (videoId) {
      const stored = await loadShortsVideoBlob(videoId);
      if (stored?.blob && stored.blob.size > 0) return stored.blob;
    }
    if (!videoUrl) throw new Error("video_missing");
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`video_fetch_${res.status}`);
    const blob = await res.blob();
    if (!blob.size) throw new Error("video_empty");
    // Cache for next mix
    if (videoId) {
      try {
        await persistShortsVideoBlob(videoId, blob, {
          fileName: get().videoFileName || "shorts.mp4",
          contentType: blob.type || contentType || "video/mp4",
        });
      } catch {
        /* ignore */
      }
    }
    return blob;
  },

  clearProject: async () => {
    const { videoId, mixedVideoUrl } = get();
    if (mixedVideoUrl) URL.revokeObjectURL(mixedVideoUrl);
    if (videoId) await deleteShortsVideoBlob(videoId);
    set({
      videoId: null,
      videoUrl: null,
      videoFileName: "",
      contentType: "video/mp4",
      sizeBytes: 0,
      storageKey: null,
      storage: null,
      ...createDefaultShortsBgmState(),
      mixedVideoUrl: null,
    });
  },
}));
