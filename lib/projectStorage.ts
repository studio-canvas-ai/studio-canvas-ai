/**
 * Studio Canvas AI proprietary project container (.sca).
 * Obfuscates / seals JSON so casual notepad edits break integrity checks.
 *
 * Client-side sealing is not DRM against determined attackers; it prevents
 * accidental or trivial external editing and validates site signature on import.
 */

export const SCA_FILE_EXT = ".sca";
export const SCA_MAGIC = "SCAENC1";
export const SCA_FORMAT_VERSION = 1;

/** Site-bound material — mixed with PBKDF2 salt (not a server secret). */
const APP_SEAL_PASS =
  "studio-canvas-ai/sca-v1/seal:7f3a9c2e-b41d-4e88-a0f1-6d5c8b9e0123";
const APP_SEAL_SALT = "sca-salt-v1-studio-canvas";

type SecureEnvelopeV1 = {
  magic: typeof SCA_MAGIC;
  v: typeof SCA_FORMAT_VERSION;
  iv: string;
  ct: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Ensure a standalone ArrayBuffer-backed view for Web Crypto BufferSource. */
function asCryptoBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

async function deriveAesKey(): Promise<CryptoKey> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("secure_crypto_unavailable");
  }
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(APP_SEAL_PASS),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(APP_SEAL_SALT),
      iterations: 120_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function isEnvelope(v: unknown): v is SecureEnvelopeV1 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.magic === SCA_MAGIC &&
    o.v === SCA_FORMAT_VERSION &&
    typeof o.iv === "string" &&
    typeof o.ct === "string"
  );
}

/** Encode arbitrary JSON-serializable project data → sealed `.sca` text. */
export async function exportSecureProject(data: unknown): Promise<string> {
  const key = await deriveAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );
  const envelope: SecureEnvelopeV1 = {
    magic: SCA_MAGIC,
    v: SCA_FORMAT_VERSION,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(cipherBuf)),
  };
  return `${SCA_MAGIC}\n${bytesToBase64(
    new TextEncoder().encode(JSON.stringify(envelope))
  )}\n`;
}

export async function exportSecureProjectBlob(data: unknown): Promise<Blob> {
  const sealed = await exportSecureProject(data);
  return new Blob([sealed], {
    type: "application/octet-stream",
  });
}

/**
 * Decode + verify a `.sca` (or legacy plain JSON / `.sca.json`) file.
 * Returns raw JSON; callers should run domain validators (e.g. parseStudioProject).
 * Tampered or foreign files throw with a clear error code.
 */
export async function importSecureProject(
  file: File | Blob | string
): Promise<unknown> {
  const text =
    typeof file === "string"
      ? file
      : await (file instanceof Blob ? file.text() : Promise.resolve(String(file)));
  const trimmed = text.trim();
  if (!trimmed) throw new Error("empty_project_file");

  // Legacy plaintext JSON (older .sca.json exports)
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error("invalid_or_tampered_project");
    }
  }

  if (!trimmed.startsWith(SCA_MAGIC)) {
    throw new Error("unsupported_project_format");
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const payloadB64 = lines.slice(1).join("").trim();
  if (!payloadB64) throw new Error("invalid_or_tampered_project");

  let envelopeRaw: unknown;
  try {
    envelopeRaw = JSON.parse(
      new TextDecoder().decode(base64ToBytes(payloadB64))
    );
  } catch {
    throw new Error("invalid_or_tampered_project");
  }

  if (!isEnvelope(envelopeRaw)) {
    throw new Error("invalid_or_tampered_project");
  }

  try {
    const key = await deriveAesKey();
    const iv = asCryptoBytes(base64ToBytes(envelopeRaw.iv));
    const ct = asCryptoBytes(base64ToBytes(envelopeRaw.ct));
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ct
    );
    const json = new TextDecoder().decode(plainBuf);
    return JSON.parse(json);
  } catch {
    throw new Error("invalid_or_tampered_project");
  }
}

/** Human-readable error for toasts. */
export function projectStorageErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : String(err || "");
  switch (code) {
    case "empty_project_file":
      return "빈 수정파일입니다.";
    case "unsupported_project_format":
      return "Studio Canvas AI 전용 수정파일(.sca)이 아닙니다.";
    case "invalid_or_tampered_project":
      return "수정파일이 손상되었거나 변조되어 불러올 수 없습니다.";
    case "secure_crypto_unavailable":
      return "이 브라우저에서는 보안 수정파일을 처리할 수 없습니다.";
    case "invalid_project":
    case "unsupported_project_kind":
    case "unsupported_project_version":
    case "invalid_project_shape":
    case "invalid_canvas_snapshot":
    case "invalid_overlay_layers":
      return "수정파일 형식이 올바르지 않습니다.";
    default:
      return "수정파일을 읽을 수 없습니다.";
  }
}
