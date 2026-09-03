import { NextResponse } from "next/server";
import {
  generateGeminiText,
  getGeminiApiKey,
  resolveGeminiModel,
} from "@/lib/gemini";
import {
  PRINT_LAYOUT_SYSTEM_INSTRUCTION,
  buildLayoutUserPrompt,
  parsePrintLayoutPlanFromText,
  type GenerateLayoutRequest,
} from "@/lib/ai/printLayoutEngine";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkGenerateRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = Partial<GenerateLayoutRequest> & {
  model?: string;
};

/**
 * POST /api/generate-layout
 * Gemini layout engine — returns { bg_prompt, elements } for Screen-26 assembly.
 * Auth + rate limit. No credit charge (paired with /api/ai-background debit).
 */
export async function POST(req: Request) {
  try {
    if (!getGeminiApiKey()) {
      return NextResponse.json(
        {
          ok: false,
          error: "gemini_unavailable",
          message: "GEMINI_API_KEY is not configured.",
        },
        { status: 503 }
      );
    }

    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, error: resolved.error, message: "Authentication required." },
        { status: resolved.status }
      );
    }

    const rl = checkGenerateRateLimit(req, resolved.user.id);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          message: "Too many requests. Please try again shortly.",
          resetAt: rl.resetAt,
        },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    const prompt =
      typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const canvasWidth = Number(body?.canvasWidth);
    const canvasHeight = Number(body?.canvasHeight);

    if (!prompt) {
      return NextResponse.json(
        {
          ok: false,
          error: "prompt_required",
          message: "Provide a prompt / theme for the layout.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(canvasWidth) ||
      !Number.isFinite(canvasHeight) ||
      canvasWidth < 64 ||
      canvasHeight < 64
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "canvas_size_required",
          message: "Provide valid canvasWidth and canvasHeight.",
        },
        { status: 400 }
      );
    }

    const layoutReq: GenerateLayoutRequest = {
      formatLabel:
        typeof body?.formatLabel === "string" && body.formatLabel.trim()
          ? body.formatLabel.trim()
          : "print",
      styleLabel:
        typeof body?.styleLabel === "string" && body.styleLabel.trim()
          ? body.styleLabel.trim()
          : "modern",
      useLabel:
        typeof body?.useLabel === "string" && body.useLabel.trim()
          ? body.useLabel.trim()
          : "flyer",
      backgroundFieldLabel:
        typeof body?.backgroundFieldLabel === "string" &&
        body.backgroundFieldLabel.trim()
          ? body.backgroundFieldLabel.trim()
          : "general",
      categoryLabel:
        typeof body?.categoryLabel === "string"
          ? body.categoryLabel.trim()
          : undefined,
      prompt,
      canvasWidth,
      canvasHeight,
      pageIndex:
        typeof body?.pageIndex === "number" ? body.pageIndex : undefined,
      pageCount:
        typeof body?.pageCount === "number" ? body.pageCount : undefined,
    };

    const userPrompt = buildLayoutUserPrompt(layoutReq);
    const result = await generateGeminiText({
      prompt: userPrompt,
      systemInstruction: PRINT_LAYOUT_SYSTEM_INSTRUCTION,
      model: resolveGeminiModel(body?.model),
      responseMimeType: "application/json",
    });

    const plan = parsePrintLayoutPlanFromText(result.text);
    if (!plan) {
      console.error("[api/generate-layout] parse failed", {
        preview: result.text.slice(0, 240),
      });
      return NextResponse.json(
        {
          ok: false,
          error: "layout_parse_failed",
          message:
            "Layout model returned invalid JSON. Please try generating again.",
          model: result.model,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      bg_prompt: plan.bg_prompt,
      elements: plan.elements,
      model: result.model,
    });
  } catch (err) {
    console.error("[api/generate-layout]", err);
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message:
          err instanceof Error
            ? err.message
            : "Layout generation failed.",
      },
      { status: 500 }
    );
  }
}
