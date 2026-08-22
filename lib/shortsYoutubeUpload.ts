/**
 * YouTube Shorts upload — Data API v3 (preferred) with Studio assist fallback.
 */

export const YOUTUBE_STUDIO_UPLOAD_URL =
  "https://studio.youtube.com/channel/UC/videos/upload?d=ud";

/** Prefer resumable client PUT above this size (Vercel request body limit). */
const DIRECT_UPLOAD_MAX_BYTES = 3_500_000;

export type ShortsYoutubePreparePayload = {
  title: string;
  description?: string;
  hasVideo: boolean;
  hasThumbnail: boolean;
  bindThumbIntro: boolean;
};

export type ShortsYoutubePrepareResult = {
  ok: boolean;
  mode: "assist" | "api";
  title: string;
  studioUrl: string;
  message?: string;
  videoId?: string;
  watchUrl?: string;
};

export type YoutubePrivacyStatus = "public" | "unlisted" | "private";

export type YoutubeUploadMeta = {
  title: string;
  description: string;
  privacyStatus: YoutubePrivacyStatus;
};

export type YoutubeUploadApiResult = {
  ok: boolean;
  mode: "api";
  videoId: string;
  watchUrl: string;
  title: string;
  privacyStatus: YoutubePrivacyStatus;
  thumbnailSet: boolean;
  message?: string;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type YoutubeConnectionStatus = {
  ok: boolean;
  configured: boolean;
  connected: boolean;
  channelTitle: string | null;
};

export async function fetchYoutubeConnectionStatus(): Promise<YoutubeConnectionStatus> {
  const res = await fetch("/api/shorts/youtube/status", {
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as YoutubeConnectionStatus & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `youtube_status_${res.status}`);
  }
  return {
    ok: true,
    configured: Boolean(data.configured),
    connected: Boolean(data.connected),
    channelTitle: data.channelTitle ?? null,
  };
}

export function youtubeConnectUrl(returnTo?: string): string {
  const path =
    returnTo ||
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/shorts/studio");
  return `/api/shorts/youtube/connect?returnTo=${encodeURIComponent(path)}`;
}

/**
 * One-click Data API upload (resumable for large Shorts).
 */
export async function uploadShortsToYoutubeApi(params: {
  title: string;
  description: string;
  privacyStatus: YoutubePrivacyStatus;
  videoBlob: Blob;
  thumbnailBlob: Blob | null;
  onProgress?: (pct: number, label?: string) => void;
}): Promise<YoutubeUploadApiResult> {
  const title = (params.title || "Studio Canvas Shorts").slice(0, 100);
  const description = (params.description || "").slice(0, 5000);
  const privacyStatus = params.privacyStatus || "unlisted";
  const videoBlob = params.videoBlob;
  const onProgress = params.onProgress;

  onProgress?.(2, "auth");

  const status = await fetchYoutubeConnectionStatus();
  if (!status.configured) {
    throw new Error("youtube_oauth_not_configured");
  }
  if (!status.connected) {
    const err = new Error("youtube_not_connected");
    (err as Error & { code?: string }).code = "not_connected";
    throw err;
  }

  // Small files: single FormData round-trip to the server.
  if (videoBlob.size > 0 && videoBlob.size <= DIRECT_UPLOAD_MAX_BYTES) {
    onProgress?.(10, "uploading");
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", description);
    fd.set("privacyStatus", privacyStatus);
    fd.set("video", videoBlob, "shorts.mp4");
    if (params.thumbnailBlob && params.thumbnailBlob.size > 0) {
      fd.set("thumbnail", params.thumbnailBlob, "thumb.jpg");
    }
    const res = await fetch("/api/shorts/youtube/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      videoId?: string;
      watchUrl?: string;
      title?: string;
      privacyStatus?: YoutubePrivacyStatus;
      thumbnailSet?: boolean;
      error?: string;
      code?: string;
    };
    if (!res.ok || !data.ok || !data.videoId) {
      const err = new Error(data.error || `youtube_upload_${res.status}`);
      (err as Error & { code?: string }).code = data.code;
      throw err;
    }
    onProgress?.(100, "done");
    return {
      ok: true,
      mode: "api",
      videoId: data.videoId,
      watchUrl: data.watchUrl || `https://youtu.be/${data.videoId}`,
      title: data.title || title,
      privacyStatus: data.privacyStatus || privacyStatus,
      thumbnailSet: Boolean(data.thumbnailSet),
    };
  }

  // Large files: server creates resumable session → client PUTs to Google.
  onProgress?.(8, "init");
  const initRes = await fetch("/api/shorts/youtube/upload", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "resumable_init",
      title,
      description,
      privacyStatus,
      videoBytes: videoBlob.size,
      videoMimeType: videoBlob.type || "video/mp4",
    }),
  });
  const initData = (await initRes.json().catch(() => ({}))) as {
    ok?: boolean;
    uploadUrl?: string;
    error?: string;
    code?: string;
  };
  if (!initRes.ok || !initData.ok || !initData.uploadUrl) {
    const err = new Error(initData.error || `youtube_init_${initRes.status}`);
    (err as Error & { code?: string }).code = initData.code;
    throw err;
  }

  onProgress?.(15, "uploading");
  const putRes = await new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", initData.uploadUrl!, true);
    xhr.setRequestHeader("Content-Type", videoBlob.type || "video/mp4");
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = 15 + Math.round((ev.loaded / ev.total) * 75);
      onProgress?.(Math.min(90, pct), "uploading");
    };
    xhr.onload = () => {
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
        })
      );
    };
    xhr.onerror = () => reject(new Error("youtube_put_network"));
    xhr.onabort = () => reject(new Error("youtube_put_aborted"));
    xhr.send(videoBlob);
  });

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(
      `youtube_put_${putRes.status}:${text.slice(0, 200) || putRes.statusText}`
    );
  }

  const putJson = (await putRes.json().catch(() => ({}))) as { id?: string };
  const videoId = putJson.id;
  if (!videoId) {
    throw new Error("youtube_upload_missing_video_id");
  }

  let thumbnailSet = false;
  if (params.thumbnailBlob && params.thumbnailBlob.size > 0) {
    onProgress?.(92, "thumbnail");
    const fd = new FormData();
    fd.set("mode", "thumbnail");
    fd.set("videoId", videoId);
    fd.set("thumbnail", params.thumbnailBlob, "thumb.jpg");
    const thumbRes = await fetch("/api/shorts/youtube/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const thumbData = (await thumbRes.json().catch(() => ({}))) as {
      ok?: boolean;
      thumbnailSet?: boolean;
    };
    thumbnailSet = Boolean(thumbRes.ok && thumbData.ok);
  }

  onProgress?.(100, "done");
  return {
    ok: true,
    mode: "api",
    videoId,
    watchUrl: `https://youtu.be/${videoId}`,
    title,
    privacyStatus,
    thumbnailSet,
  };
}

/**
 * Legacy assist: download assets + open YouTube Studio.
 */
export async function publishShortsToYoutubeAssist(params: {
  title: string;
  description?: string;
  videoBlob: Blob | null;
  thumbnailBlob: Blob | null;
  bindThumbIntro?: boolean;
  baseName?: string;
}): Promise<ShortsYoutubePrepareResult> {
  const title = (params.title || "Studio Canvas Shorts").slice(0, 100);
  const base = (params.baseName || "shorts")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 60);

  const res = await fetch("/api/shorts/youtube/prepare", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description: params.description || "",
      hasVideo: Boolean(params.videoBlob && params.videoBlob.size > 0),
      hasThumbnail: Boolean(
        params.thumbnailBlob && params.thumbnailBlob.size > 0
      ),
      bindThumbIntro: Boolean(params.bindThumbIntro),
    } satisfies ShortsYoutubePreparePayload),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    mode?: "assist" | "api";
    studioUrl?: string;
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `youtube_prepare_${res.status}`);
  }

  if (params.thumbnailBlob && params.thumbnailBlob.size > 0) {
    downloadBlob(params.thumbnailBlob, `${base}-thumb.jpg`);
  }
  if (params.videoBlob && params.videoBlob.size > 0) {
    downloadBlob(params.videoBlob, `${base}-shorts.mp4`);
  }

  const studioUrl = data.studioUrl || YOUTUBE_STUDIO_UPLOAD_URL;
  const win = window.open(studioUrl, "_blank", "noopener,noreferrer");
  if (!win) {
    throw new Error("popup_blocked");
  }

  return {
    ok: true,
    mode: data.mode || "assist",
    title,
    studioUrl,
    message: data.message,
  };
}
