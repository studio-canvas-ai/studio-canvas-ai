import { GoogleGenAI } from "@google/genai";

/** Default frontier model for text generation. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";

const ALLOWED_GEMINI_MODELS = new Set([
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
]);

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

export function resolveGeminiModel(model?: string | null): string {
  const normalized = model?.trim();
  if (normalized && ALLOWED_GEMINI_MODELS.has(normalized)) return normalized;
  return DEFAULT_GEMINI_MODEL;
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
};

export async function generateGeminiText({
  prompt,
  systemInstruction,
  model,
}: GeminiGenerateParams): Promise<{ text: string; model: string }> {
  const ai = getGeminiClient();
  const resolvedModel = resolveGeminiModel(model);

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
