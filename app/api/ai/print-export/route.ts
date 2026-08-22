import { NextResponse } from "next/server";
import {
  exportPrintReadyAssets,
  PRINT_READY_DPI,
  type PrintReadyPlane,
} from "@/lib/ai/printReadyExport";
import { checkGenerateRateLimit } from "@/lib/rateLimit";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { newRequestId } from "@/lib/ai/commandParser";

export const runtime = "nodejs";
export const maxDuration = 60;

type PlaneBody = {
  role?: string;
  /** data:image/...;base64,... or https URL (fetched server-side) */
  dataUrl?: string;
  imageUrl?: string;
  contentType?: string;
  width?: number;
  height?: number;
};

type Body = {
  requestId?: string;
  formatLabel?: string;
  dpi?: number;
  persist?: boolean;
  planes?: PlaneBody[];
};

const MAX_PLANE_BYTES = 25 * 1024 * 1024;
const MAX_PLANES = 6;

async function planeToBytes(
  plane: PlaneBody
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const dataUrl =
    typeof plane.dataUrl === "string" ? plane.dataUrl.trim() : "";
  if (dataUrl.startsWith("data:")) {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
    if (!m) return null;
    const contentType = m[1] || "image/png";
    const bytes = Buffer.from(m[2]!, "base64");
    if (bytes.byteLength > MAX_PLANE_BYTES) return null;
    return { bytes, contentType };
  }

  const imageUrl =
    (typeof plane.imageUrl === "string" && plane.imageUrl.trim()) || "";
  if (!/^https:\/\//i.test(imageUrl)) return null;

  const res = await fetch(imageUrl, { cache: "no-store" });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_PLANE_BYTES) return null;
  const contentType =
    plane.contentType ||
    res.headers.get("content-type") ||
    "image/jpeg";
  return { bytes: buf, contentType };
}

function normalizeRole(role: unknown): PrintReadyPlane["role"] {
  const r = String(role || "full").toLowerCase();
  if (r === "background" || r === "subject" || r === "composite") return r;
  return "full";
}

/**
 * POST /api/ai/print-export
 * High-DPI print-ready assets → optional Cloudflare R2 persistence.
 */
export async function POST(req: Request) {
  try {
    const resolved = await resolveAppUser(req);
    const userId = resolved.ok ? resolved.user.id : null;
    const rl = checkGenerateRateLimit(req, userId);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", resetAt: rl.resetAt },
        { status: 429 }
      );
    }

    const raw = (await req.json().catch(() => null)) as Body | null;
    const planesIn = Array.isArray(raw?.planes) ? raw!.planes!.slice(0, MAX_PLANES) : [];
    if (!planesIn.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "planes_required",
          message: "Provide at least one print plane (dataUrl or imageUrl).",
        },
        { status: 400 }
      );
    }

    const planes: PrintReadyPlane[] = [];
    for (const p of planesIn) {
      const converted = await planeToBytes(p);
      if (!converted) {
        return NextResponse.json(
          {
            ok: false,
            error: "plane_invalid",
            message:
              "Each plane needs a valid data URL or https imageUrl under size limits.",
          },
          { status: 400 }
        );
      }
      planes.push({
        role: normalizeRole(p.role),
        contentType: converted.contentType,
        bytes: converted.bytes,
        width:
          typeof p.width === "number" && Number.isFinite(p.width)
            ? p.width
            : undefined,
        height:
          typeof p.height === "number" && Number.isFinite(p.height)
            ? p.height
            : undefined,
      });
    }

    const requestId =
      (typeof raw?.requestId === "string" && raw.requestId.trim()) ||
      newRequestId();

    const result = await exportPrintReadyAssets({
      userId,
      requestId,
      formatLabel:
        typeof raw?.formatLabel === "string" ? raw.formatLabel : undefined,
      dpi:
        typeof raw?.dpi === "number" && Number.isFinite(raw.dpi)
          ? raw.dpi
          : PRINT_READY_DPI,
      persist: raw?.persist !== false,
      planes,
    });

    if (!result.ok) {
      return NextResponse.json(result, {
        status: result.error === "r2_unconfigured" ? 503 : 500,
      });
    }

    return NextResponse.json({
      ok: true,
      requestId: result.requestId,
      dpi: result.dpi,
      r2Configured: result.r2Configured,
      persisted: result.persisted,
      assets: result.assets.map((a) => ({
        role: a.role,
        key: a.key,
        url: a.signedUrl || a.publicUrl,
        publicUrl: a.publicUrl,
        signedUrl: a.signedUrl,
        contentType: a.contentType,
        byteLength: a.byteLength,
        width: a.width,
        height: a.height,
      })),
      message: result.persisted
        ? "Print-ready assets stored on R2."
        : result.r2Configured
          ? "Export computed (persist skipped)."
          : "Export computed. Configure R2 to persist originals.",
    });
  } catch (error) {
    console.error("[api/ai/print-export] failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "print_export_failed",
        message:
          error instanceof Error ? error.message : "Print export failed",
      },
      { status: 500 }
    );
  }
}
