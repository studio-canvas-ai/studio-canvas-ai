import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  extractPosterFromBuffer,
  extractPosterFromFragments,
  extractPosterFromTail,
} from "@/lib/shortsQuickPoster.server";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/** Stay under Vercel ~4.5 MB request body limit per part. */
const MAX_PART_BYTES = 3.8 * 1024 * 1024;

/**
 * POST /api/shorts/quick-poster
 * Extract a JPEG poster from MP4 head/tail fragments (no full upload).
 */
export async function POST(req: Request) {
  try {
    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status }
      );
    }

    const form = await req.formData();
    const head = form.get("head");
    const tail = form.get("tail");

    let poster: Buffer | null = null;

    if (tail instanceof Blob && tail.size > 0) {
      const tailBuf = Buffer.from(await tail.arrayBuffer());
      if (tailBuf.length > MAX_PART_BYTES) {
        return NextResponse.json({ error: "tail_too_large" }, { status: 413 });
      }

      if (head instanceof Blob && head.size > 0) {
        const headBuf = Buffer.from(await head.arrayBuffer());
        if (headBuf.length > MAX_PART_BYTES) {
          return NextResponse.json({ error: "head_too_large" }, { status: 413 });
        }
        poster = await extractPosterFromFragments(headBuf, tailBuf);
      } else {
        poster = await extractPosterFromTail(tailBuf);
      }
    } else if (head instanceof Blob && head.size > 0) {
      const headBuf = Buffer.from(await head.arrayBuffer());
      if (headBuf.length > MAX_PART_BYTES) {
        return NextResponse.json({ error: "head_too_large" }, { status: 413 });
      }
      poster = await extractPosterFromBuffer(headBuf, "head.mp4");
    }

    if (!poster?.length) {
      return NextResponse.json(
        { ok: false, error: "poster_extract_failed" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      posterDataUrl: `data:image/jpeg;base64,${poster.toString("base64")}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "quick_poster_failed";
    console.error("[shorts/quick-poster]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
