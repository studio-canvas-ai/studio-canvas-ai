import { NextResponse } from "next/server";
import {
  generateGeminiText,
  getGeminiApiKey,
  resolveGeminiModel,
} from "@/lib/gemini";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkGenerateRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PROMPT_CHARS = 12_000;
const MAX_SYSTEM_CHARS = 8_000;

type GeminiRequestBody = {
  prompt?: string;
  systemInstruction?: string;
  model?: string;
};

/**
 * POST /api/gemini
 * JSON body: { prompt, systemInstruction?, model? }
 * Auth + rate limit required. API key stays server-side only.
 */
export async function POST(req: Request) {
  try {
    if (!getGeminiApiKey()) {
      return NextResponse.json(
        { error: "gemini_unavailable", code: "missing_api_key" },
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

    const rl = checkGenerateRateLimit(req, resolved.user.id);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", code: "rate_limited", resetAt: rl.resetAt },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => null)) as GeminiRequestBody | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const systemInstruction =
      typeof body?.systemInstruction === "string"
        ? body.systemInstruction.trim()
        : "";
    const model = resolveGeminiModel(body?.model);

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt_required", code: "prompt_required" },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        { error: "prompt_too_long", code: "prompt_too_long" },
        { status: 400 }
      );
    }

    if (systemInstruction.length > MAX_SYSTEM_CHARS) {
      return NextResponse.json(
        {
          error: "system_instruction_too_long",
          code: "system_instruction_too_long",
        },
        { status: 400 }
      );
    }

    const result = await generateGeminiText({
      prompt,
      systemInstruction: systemInstruction || undefined,
      model,
    });

    return NextResponse.json({
      ok: true,
      text: result.text,
      model: result.model,
    });
  } catch (err) {
    console.error("[api/gemini]", err);
    return NextResponse.json(
      { error: "internal_error", code: "internal_error" },
      { status: 500 }
    );
  }
}
