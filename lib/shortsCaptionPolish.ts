/**
 * Post-Whisper short-form caption polish + keyword highlight spans (OpenAI chat).
 */

import OpenAI from "openai";
import {
  createCaptionSegment,
  normalizeHighlights,
  type ShortsCaptionHighlight,
  type ShortsCaptionSegment,
} from "@/lib/shortsCaptions";

export type PolishCaptionInput = {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
};

type PolishItem = {
  id?: string;
  text?: string;
  highlights?: { start?: number; end?: number }[];
};

const SYSTEM_PROMPT = `You polish YouTube Shorts / Reels captions for Korean (and mixed EN) creators.
Rules:
- Keep the same segment id and do NOT change timing.
- Fix spacing and spelling; make lines short and punchy for vertical video.
- Prefer 8–22 Korean characters per segment when possible; do not invent new facts.
- Return JSON only: { "segments": [ { "id": string, "text": string, "highlights": [ { "start": number, "end": number } ] } ] }
- highlights are UTF-16 code unit offsets into the NEW text for key nouns, numbers, or exclamations (0–3 spans per line).
- If a line has nothing to emphasize, use an empty highlights array.`;

export async function polishCaptionSegments(params: {
  apiKey: string;
  segments: PolishCaptionInput[];
  language?: string | null;
}): Promise<ShortsCaptionSegment[]> {
  const input = params.segments
    .filter((s) => s.id && String(s.text || "").trim())
    .slice(0, 80)
    .map((s) => ({
      id: s.id,
      text: String(s.text).slice(0, 200),
      startSec: s.startSec,
      endSec: s.endSec,
    }));

  if (!input.length) return [];

  const client = new OpenAI({
    apiKey: params.apiKey,
    timeout: 60_000,
    maxRetries: 1,
  });

  const started = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            language: params.language || "ko",
            segments: input,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed: { segments?: PolishItem[] } = {};
    try {
      parsed = JSON.parse(raw) as { segments?: PolishItem[] };
    } catch {
      console.error("[shorts/polish] invalid JSON", raw.slice(0, 400));
      return input.map((s) => createCaptionSegment(s));
    }

    const byId = new Map<string, PolishItem>();
    for (const item of parsed.segments || []) {
      if (item?.id) byId.set(String(item.id), item);
    }

    const out = input.map((s) => {
      const p = byId.get(s.id);
      const text =
        typeof p?.text === "string" && p.text.trim() ? p.text.trim() : s.text;
      const highlights: ShortsCaptionHighlight[] = normalizeHighlights(
        text,
        (p?.highlights || []).map((h) => ({
          start: Number(h.start) || 0,
          end: Number(h.end) || 0,
        }))
      );
      return createCaptionSegment({
        id: s.id,
        text,
        startSec: s.startSec,
        endSec: s.endSec,
        highlights,
      });
    });

    console.info("[shorts/polish] ok", {
      ms: Date.now() - started,
      count: out.length,
    });
    return out;
  } catch (err) {
    console.error("[shorts/polish] failed — returning original text", {
      ms: Date.now() - started,
      err: err instanceof Error ? err.message : String(err),
    });
    return input.map((s) => createCaptionSegment(s));
  }
}
