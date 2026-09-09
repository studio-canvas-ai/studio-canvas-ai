import { Readable } from "node:stream";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { YoutubePrivacyStatus } from "@/lib/youtube/config";

export type YoutubeUploadResult = {
  videoId: string;
  watchUrl: string;
  title: string;
  privacyStatus: YoutubePrivacyStatus;
  thumbnailSet: boolean;
};

function toReadable(data: Buffer): Readable {
  return Readable.from(data);
}

/**
 * Resumable videos.insert via googleapis (stream body) + optional thumbnails.set.
 */
export async function uploadShortsVideoToYoutube(params: {
  auth: OAuth2Client;
  videoBuffer: Buffer;
  videoMimeType?: string;
  thumbnailBuffer?: Buffer | null;
  thumbnailMimeType?: string;
  title: string;
  description: string;
  privacyStatus: YoutubePrivacyStatus;
}): Promise<YoutubeUploadResult> {
  const youtube = google.youtube({ version: "v3", auth: params.auth });
  const title = params.title.trim().slice(0, 100) || "Studio Canvas Shorts";
  const description = params.description.slice(0, 5000);
  const privacyStatus = params.privacyStatus;

  const insertRes = await youtube.videos.insert({
    part: ["snippet", "status"],
    notifySubscribers: false,
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: "22",
        tags: ["Shorts", "StudioCanvasAI"],
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      mimeType: params.videoMimeType || "video/mp4",
      body: toReadable(params.videoBuffer),
    },
  });

  const videoId = insertRes.data.id;
  if (!videoId) {
    throw new Error("youtube_upload_missing_video_id");
  }

  let thumbnailSet = false;
  if (params.thumbnailBuffer && params.thumbnailBuffer.length > 0) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: params.thumbnailMimeType || "image/jpeg",
          body: toReadable(params.thumbnailBuffer),
        },
      });
      thumbnailSet = true;
    } catch (err) {
      console.warn("[youtube] thumbnails.set failed", err);
    }
  }

  return {
    videoId,
    watchUrl: `https://youtu.be/${videoId}`,
    title,
    privacyStatus,
    thumbnailSet,
  };
}

/**
 * Start a Google resumable upload session; client PUTs the video bytes to uploadUrl.
 */
export async function createYoutubeResumableUploadSession(params: {
  accessToken: string;
  title: string;
  description: string;
  privacyStatus: YoutubePrivacyStatus;
  videoBytes: number;
  videoMimeType?: string;
}): Promise<string> {
  const title = params.title.trim().slice(0, 100) || "Studio Canvas Shorts";
  const description = params.description.slice(0, 5000);
  const mime = params.videoMimeType || "video/mp4";

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(params.videoBytes),
        "X-Upload-Content-Type": mime,
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          categoryId: "22",
          tags: ["Shorts", "StudioCanvasAI"],
        },
        status: {
          privacyStatus: params.privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    throw new Error(
      `youtube_resumable_init_${initRes.status}:${text.slice(0, 240)}`
    );
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) {
    throw new Error("youtube_resumable_missing_location");
  }
  return uploadUrl;
}

export async function setYoutubeThumbnail(params: {
  auth: OAuth2Client;
  videoId: string;
  thumbnailBuffer: Buffer;
  thumbnailMimeType?: string;
}): Promise<void> {
  const youtube = google.youtube({ version: "v3", auth: params.auth });
  await youtube.thumbnails.set({
    videoId: params.videoId,
    media: {
      mimeType: params.thumbnailMimeType || "image/jpeg",
      body: toReadable(params.thumbnailBuffer),
    },
  });
}
