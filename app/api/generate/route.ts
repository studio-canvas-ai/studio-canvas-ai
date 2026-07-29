import { NextResponse } from "next/server";
import type { FaceConsistencyPayload } from "@/lib/faceConsistency";

export const runtime = "nodejs";

/**
 * Portrait generate / regenerate endpoint (#105–#106).
 * Accepts Face Consistency payload (selfie + optional draft dual-ref).
 * Currently returns an acknowledged job stub; wire real model runner here.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FaceConsistencyPayload;
    if (!body?.selfieUrls?.length && body.mode === "initial") {
      return NextResponse.json({ error: "selfieUrls required" }, { status: 400 });
    }
    if (body.mode === "regenerate" && (!body.draftUrl || !body.selfieUrls?.length)) {
      return NextResponse.json(
        { error: "dual reference requires selfieUrls + draftUrl" },
        { status: 400 }
      );
    }

    // Identity lock sanity — reject weak face weights
    if ((body.faceId?.faceWeight ?? 0) < 1 || (body.ipAdapter?.faceIdWeight ?? 0) < 1) {
      return NextResponse.json(
        { error: "face consistency weights must be maximized (1.0)" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: body.mode,
      creditCost: body.creditCost,
      identityLock: body.identityLock,
      dualReference: body.dualReference,
      // Stub: frontend continues mock image swap until real GPU worker is attached
      status: "accepted",
      message: "Face-consistency payload accepted (InsightFace + IP-Adapter + ControlNet).",
    });
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
}
