/**
 * Print-ready High-DPI export + optional Cloudflare R2 persistence.
 * Screen preview stays light; this path stores full-resolution print assets.
 */

import {
  createR2Client,
  getR2Config,
  isR2Configured,
  publicObjectUrl,
  putR2Object,
} from "@/lib/r2";
import { createSignedGetUrl } from "@/lib/downloadUrl";

export const PRINT_READY_DPI = 300;

/** Max edge for a single print page upload (guards memory / R2 costs). */
export const PRINT_READY_MAX_EDGE = 8192;

export type PrintReadyPlane = {
  role: "background" | "subject" | "composite" | "full";
  /** https / data URI / relative proxy URL already fetched as bytes by caller */
  contentType: string;
  bytes: Buffer;
  width?: number;
  height?: number;
};

export type PrintReadyExportInput = {
  userId?: string | null;
  requestId: string;
  formatLabel?: string;
  dpi?: number;
  planes: PrintReadyPlane[];
  /** Persist to R2 when configured; otherwise return metadata only. */
  persist?: boolean;
};

export type PrintReadyStoredAsset = {
  role: PrintReadyPlane["role"];
  key: string | null;
  publicUrl: string | null;
  signedUrl: string | null;
  contentType: string;
  byteLength: number;
  width?: number;
  height?: number;
};

export type PrintReadyExportResult = {
  ok: true;
  requestId: string;
  dpi: number;
  r2Configured: boolean;
  persisted: boolean;
  assets: PrintReadyStoredAsset[];
};

export type PrintReadyExportError = {
  ok: false;
  error: string;
  message: string;
  requestId: string;
};

function safeKeyPart(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64);
}

export async function exportPrintReadyAssets(
  input: PrintReadyExportInput
): Promise<PrintReadyExportResult | PrintReadyExportError> {
  const dpi = Math.max(72, Math.min(600, input.dpi ?? PRINT_READY_DPI));
  const requestId = input.requestId || `print_${Date.now()}`;
  const persist = input.persist !== false;
  const r2Ok = isR2Configured();

  if (!input.planes.length) {
    return {
      ok: false,
      error: "no_planes",
      message: "No print planes provided for export.",
      requestId,
    };
  }

  const assets: PrintReadyStoredAsset[] = [];

  if (!persist || !r2Ok) {
    for (const plane of input.planes) {
      assets.push({
        role: plane.role,
        key: null,
        publicUrl: null,
        signedUrl: null,
        contentType: plane.contentType,
        byteLength: plane.bytes.byteLength,
        width: plane.width,
        height: plane.height,
      });
    }
    return {
      ok: true,
      requestId,
      dpi,
      r2Configured: r2Ok,
      persisted: false,
      assets,
    };
  }

  const config = getR2Config();
  if (!config) {
    return {
      ok: false,
      error: "r2_unconfigured",
      message: "Cloudflare R2 is not configured for print-ready storage.",
      requestId,
    };
  }

  try {
    const client = createR2Client(config);
    const owner = safeKeyPart(input.userId || "anon");
    const stamp = safeKeyPart(requestId);

    for (let i = 0; i < input.planes.length; i++) {
      const plane = input.planes[i]!;
      const ext =
        plane.contentType.includes("png")
          ? "png"
          : plane.contentType.includes("webp")
            ? "webp"
            : "jpg";
      const key = `print-ready/${owner}/${stamp}/${i}-${plane.role}.${ext}`;

      await putR2Object(
        client,
        config.bucketName,
        key,
        plane.bytes,
        plane.contentType
      );

      const publicUrl = publicObjectUrl(config, key);
      let signedUrl: string | null = null;
      try {
        signedUrl = await createSignedGetUrl(config, key, 60 * 60);
      } catch (err) {
        console.warn("[printReadyExport] signed URL failed", {
          key,
          err: err instanceof Error ? err.message : String(err),
        });
      }

      assets.push({
        role: plane.role,
        key,
        publicUrl,
        signedUrl,
        contentType: plane.contentType,
        byteLength: plane.bytes.byteLength,
        width: plane.width,
        height: plane.height,
      });
    }

    console.info("[printReadyExport] persisted", {
      requestId,
      dpi,
      count: assets.length,
      formatLabel: input.formatLabel || null,
    });

    return {
      ok: true,
      requestId,
      dpi,
      r2Configured: true,
      persisted: true,
      assets,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "print_export_failed";
    console.error("[printReadyExport] failed", { requestId, message });
    return {
      ok: false,
      error: "print_export_failed",
      message,
      requestId,
    };
  }
}
