import { GoogleGenAI } from "@google/genai";

/**
 * Current stable Flash for high-throughput routing (intent → English Flux prompt).
 * gemini-2.5-flash returns 404 ("no longer available") on some API keys/regions.
 * Docs migration path from Gemini 2.0 shutdown: gemini-3.5-flash (+ newer 3.6/3.7).
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

/** Fast router default (same as DEFAULT unless env overrides). */
export const DEFAULT_GEMINI_ROUTER_MODEL = "gemini-3.5-flash";

const ALLOWED_GEMINI_MODELS = new Set([
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  // Legacy aliases — remapped in resolveGeminiModel / fallback chain
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
]);

/** Deprecated IDs → current stable replacements. */
const DEPRECATED_MODEL_ALIASES: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3.5-flash",
  "gemini-2.5-pro": "gemini-3.5-flash",
  "gemini-2.0-flash": "gemini-3.5-flash",
  "gemini-1.5-flash": "gemini-3.5-flash",
  "gemini-1.5-pro": "gemini-3.5-flash",
};

/**
 * Ordered fallbacks when the primary model returns 404 / unavailable.
 * Prefer speed/cost for intent routing; keep several stables in case one is retired.
 */
export const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

function normalizeModelId(model?: string | null): string | null {
  const raw = model?.trim();
  if (!raw) return null;
  // Accept "models/gemini-…" form from error logs / SDK quirks.
  return raw.replace(/^models\//i, "");
}

const FALLBACK_SET = new Set<string>(GEMINI_MODEL_FALLBACKS);

export function resolveGeminiModel(model?: string | null): string {
  const fromEnv = normalizeModelId(process.env.GEMINI_MODEL);
  const requested = normalizeModelId(model) || fromEnv;

  if (!requested) return DEFAULT_GEMINI_MODEL;

  const aliased = DEPRECATED_MODEL_ALIASES[requested] || requested;
  if (ALLOWED_GEMINI_MODELS.has(aliased) || FALLBACK_SET.has(aliased)) {
    return aliased;
  }

  // Env may pin a newer GA id before the allowlist is updated.
  console.warn("[gemini] unrecognized model id, using as-is:", aliased);
  return aliased;
}

export function resolveGeminiRouterModel(model?: string | null): string {
  const fromEnv =
    normalizeModelId(process.env.GEMINI_ROUTER_MODEL) ||
    normalizeModelId(process.env.GEMINI_MODEL);
  return resolveGeminiModel(model || fromEnv || DEFAULT_GEMINI_ROUTER_MODEL);
}

function isModelUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /\[404\]/i.test(msg) ||
    /no longer available/i.test(msg) ||
    /not found/i.test(msg) ||
    /is not found/i.test(msg) ||
    /NOT_FOUND/i.test(msg)
  );
}

function uniqueModels(primary: string): string[] {
  const ordered = [primary, ...GEMINI_MODEL_FALLBACKS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of ordered) {
    const id = DEPRECATED_MODEL_ALIASES[m] || m;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

export type GeminiGenerateParams = {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  /** When true (default), retry GEMINI_MODEL_FALLBACKS on 404/unavailable. */
  withFallback?: boolean;
};

async function generateOnce(
  ai: GoogleGenAI,
  resolvedModel: string,
  prompt: string,
  systemInstruction?: string
): Promise<{ text: string; model: string }> {
  const response = await ai.models.generateContent({
    model: resolvedModel,
    contents: prompt,
    config: systemInstruction?.trim()
      ? { systemInstruction: systemInstruction.trim() }
      : undefined,
  });

  const text = response.text?.trim() ?? "";
  if (!text) {
    throw new Error("empty_model_response");
  }

  return { text, model: resolvedModel };
}

export async function generateGeminiText({
  prompt,
  systemInstruction,
  model,
  withFallback = true,
}: GeminiGenerateParams): Promise<{ text: string; model: string }> {
  const ai = getGeminiClient();
  const primary = resolveGeminiModel(model);
  const candidates = withFallback ? uniqueModels(primary) : [primary];

  let lastError: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    try {
      const result = await generateOnce(ai, candidate, prompt, systemInstruction);
      if (i > 0) {
        console.warn("[gemini] fell back after unavailable model", {
          from: primary,
          to: candidate,
        });
      }
      return result;
    } catch (err) {
      lastError = err;
      const canRetry =
        withFallback && i < candidates.length - 1 && isModelUnavailableError(err);
      if (!canRetry) throw err;
      console.warn("[gemini] model unavailable, trying next", {
        model: candidate,
        err: err instanceof Error ? err.message : String(err),
        next: candidates[i + 1],
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "gemini_generate_failed"));
}
