import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import { polishCaptionSegments } from "@/lib/shortsCaptionPolish";
import { getOpenAiApiKey } from "@/lib/shortsStt";
import type { ShortsCaptionSegment } from "@/lib/shortsCaptions";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/shorts/captions/polish
 * JSON body: { segments: ShortsCaptionSegment[], language? }
 * Free re-polish (text-only). Auth + rate limit required.
 */
export async function POST(req: Request) {
  try {
    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "stt_unavailable", code: "missing_api_key" },
        { status: 503 }
      );
    }

    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, code: "auth" },
        { status: resolved.status }
      );
    }

    const rl = checkUploadRateLimit(req, resolved.user.id);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", code: "rate_limited", resetAt: rl.resetAt },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      segments?: ShortsCaptionSegment[];
      language?: string;
    } | null;

    const segments = Array.isArray(body?.segments) ? body!.segments! : [];
    if (!segments.length) {
      return NextResponse.json(
        { error: "segments_required", code: "segments_required" },
        { status: 400 }
      );
    }

    const polished = await polishCaptionSegments({
      apiKey,
      language: body?.language || "ko",
      segments: segments.map((s) => ({
        id: s.id,
        text: s.text,
        startSec: s.startSec,
        endSec: s.endSec,
      })),
    });

    // Preserve placement / preset from input
    const byId = new Map(segments.map((s) => [s.id, s]));
    const merged = polished.map((p) => {
      const prev = byId.get(p.id);
      return {
        ...p,
        x: prev?.x ?? p.x,
        y: prev?.y ?? p.y,
        stylePresetId: prev?.stylePresetId,
      };
    });

    return NextResponse.json({ ok: true, segments: merged });
  } catch (err) {
    console.error("[shorts/captions/polish]", err);
    return NextResponse.json(
      { error: "internal_error", code: "internal_error" },
      { status: 500 }
    );
  }
}
