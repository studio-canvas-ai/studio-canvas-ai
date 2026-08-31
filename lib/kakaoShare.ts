/**
 * Kakao Talk Share (JavaScript SDK v2).
 *
 * Isolated from Supabase Auth / Google login / YouTube share:
 * - SDK is loaded only when Kakao share is invoked (not in root layout).
 * - Init uses a single hardcoded JavaScript key (never env, never Supabase keys).
 *
 * Console checklist:
 * - [앱] > [플랫폼 키] > [JavaScript 키] > [JavaScript SDK 도메인]
 *     https://www.studio-canvas-ai.com
 *     https://studio-canvas-ai.com
 * - [앱] > [제품 링크 관리] > [웹 도메인] (same)
 */

export const KAKAO_REGISTERED_ORIGIN = "https://www.studio-canvas-ai.com";

/**
 * Current Kakao JavaScript key (32 hex). Assembled from chunks so spaced pastes cannot sneak in.
 * NEVER read from process.env for Kakao.init.
 */
export const KAKAO_JS_KEY = ["11b99bf5", "0fa43f53", "e8fab8e5", "272ff2b4"].join("");

/** Known-bad keys previously seen in stale browser caches / old builds — never reuse. */
const BLOCKED_LEGACY_KAKAO_JS_KEYS = new Set([
  "1100b60f0a48158bf8afb868272112b4",
]);

const EXPECTED_JS_KEY = KAKAO_JS_KEY;
const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js";
const SHARE_LINK = "https://www.studio-canvas-ai.com";
const FALLBACK_SHARE_IMAGE =
  "https://www.studio-canvas-ai.com/styles/traditional-west.png";

/** Strip ALL whitespace (spaces, NBSP, newlines) before Kakao.init. */
function sanitizeKakaoJsKey(raw: string): string {
  return String(raw ?? "").replace(/[\s\u00A0\u200B\uFEFF]+/g, "");
}

function resolveInitKey(): string {
  const key = sanitizeKakaoJsKey(KAKAO_JS_KEY);
  if (key.length !== 32) {
    throw new Error(
      `[kakaoShare] invalid JS key length ${key.length} (expected 32): ${JSON.stringify(key)}`
    );
  }
  if (key !== EXPECTED_JS_KEY) {
    throw new Error(
      `[kakaoShare] JS key mismatch after sanitize: ${JSON.stringify(key)}`
    );
  }
  if (BLOCKED_LEGACY_KAKAO_JS_KEYS.has(key)) {
    throw new Error("[kakaoShare] blocked legacy JavaScript key");
  }
  return key;
}

type KakaoShareApi = {
  uploadImage?: (settings: {
    file: FileList;
  }) => Promise<{ infos?: { original?: { url?: string } } }>;
  sendDefault: (settings: Record<string, unknown>) => void;
};

type KakaoSDK = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  cleanup?: () => void;
  Share?: KakaoShareApi;
};

declare global {
  interface Window {
    Kakao?: KakaoSDK;
    /** Marker for which JS key this tab initialized (detects stale SDK sessions). */
    __SCA_KAKAO_APP_KEY?: string;
  }
}

let loadPromise: Promise<KakaoSDK> | null = null;

function kakaoDebugEnabled(): boolean {
  try {
    return (
      process.env.NEXT_PUBLIC_KAKAO_DEBUG === "true" ||
      window.localStorage?.getItem("sca_kakao_debug") === "1"
    );
  } catch {
    return false;
  }
}

function dbg(phase: string, notes: string[] = []) {
  if (!kakaoDebugEnabled()) return;
  console.info(`[kakaoShare] ${phase}`, {
    keyPrefix: EXPECTED_JS_KEY.slice(0, 8),
    markedKey: window.__SCA_KAKAO_APP_KEY?.slice(0, 8) ?? null,
    isInitialized: Boolean(window.Kakao?.isInitialized?.()),
    notes,
  });
}

export function getKakaoJsKey(): string {
  return EXPECTED_JS_KEY;
}

export function isKakaoShareConfigured(): boolean {
  return true;
}

export function toKakaoShareLink(_url?: string | null): string {
  return SHARE_LINK;
}

function clampText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function isKakaoCdnImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".kakaocdn.net") ||
      host.endsWith(".kakao.com") ||
      host.endsWith(".kakao.co.kr") ||
      host.includes("kage.kakao.com")
    );
  } catch {
    return false;
  }
}

function loadKakaoScript(): Promise<KakaoSDK> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Kakao SDK is browser-only"));
  }
  if (window.Kakao?.Share?.sendDefault) {
    return Promise.resolve(window.Kakao);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<KakaoSDK>((resolve, reject) => {
    const finish = () => {
      if (window.Kakao) {
        dbg("sdk-loaded", ["Kakao global is present"]);
        resolve(window.Kakao);
      } else reject(new Error("Kakao SDK loaded without Kakao global"));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kakao-sdk="v2"], script[src*="kakao_js_sdk/2."]'
    );

    if (window.Kakao) {
      finish();
      return;
    }

    if (existing) {
      dbg("sdk-script-already-in-dom", [existing.src]);
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () => {
        loadPromise = null;
        reject(new Error("Kakao SDK script failed"));
      });
      let tries = 0;
      const timer = window.setInterval(() => {
        tries += 1;
        if (window.Kakao) {
          window.clearInterval(timer);
          finish();
        } else if (tries > 50) {
          window.clearInterval(timer);
          reject(new Error("Kakao SDK not ready"));
        }
      }, 50);
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.kakaoSdk = "v2";
    script.onload = finish;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Kakao SDK"));
    };
    document.head.appendChild(script);
    dbg("sdk-script-injected", [KAKAO_SDK_SRC]);
  });

  return loadPromise;
}

/**
 * Init Kakao only for share. If a stale tab still holds a legacy/wrong app key
 * (e.g. cached old layout-init), cleanup once then init the current key.
 * Does not touch Supabase auth storage or YouTube share.
 */
export async function ensureKakaoReady(): Promise<KakaoSDK> {
  const Kakao = await loadKakaoScript();
  const initKey = resolveInitKey();
  const marked = window.__SCA_KAKAO_APP_KEY;
  const needsReset =
    Kakao.isInitialized() &&
    (marked !== initKey ||
      (typeof marked === "string" && BLOCKED_LEGACY_KAKAO_JS_KEYS.has(marked)));

  if (!Kakao.isInitialized() || needsReset) {
    if (needsReset && typeof Kakao.cleanup === "function") {
      dbg("stale-session-cleanup", [
        `marked=${marked ?? "none"}`,
        "resetting before init with current JavaScript key",
      ]);
      try {
        Kakao.cleanup();
      } catch {
        /* ignore */
      }
      try {
        delete window.__SCA_KAKAO_APP_KEY;
      } catch {
        window.__SCA_KAKAO_APP_KEY = undefined;
      }
    }
    dbg("init", [`keyPrefix=${initKey.slice(0, 8)}`]);
    Kakao.init(initKey);
    window.__SCA_KAKAO_APP_KEY = initKey;
  } else {
    dbg("reuse-init", [`keyPrefix=${initKey.slice(0, 8)}`]);
  }

  if (!Kakao.isInitialized()) {
    throw new Error("Kakao.init failed — check JavaScript key");
  }
  if (!Kakao.Share?.sendDefault) {
    throw new Error("Kakao.Share.sendDefault unavailable — SDK v2 required");
  }
  return Kakao;
}

function toFileList(file: File): FileList {
  const dt = new DataTransfer();
  dt.items.add(file);
  return dt.files;
}

async function uploadImageToKakao(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Kakao image exceeds 5MB");
  }
  const Kakao = await ensureKakaoReady();
  if (typeof Kakao.Share?.uploadImage !== "function") {
    throw new Error("Kakao.Share.uploadImage unavailable");
  }
  const res = await Kakao.Share.uploadImage({ file: toFileList(file) });
  const url = res?.infos?.original?.url;
  if (!url || !isKakaoCdnImageUrl(url)) {
    throw new Error("Kakao image upload returned unusable URL");
  }
  return url;
}

export type KakaoFeedShareOptions = {
  title: string;
  description: string;
  imageUrl?: string;
  buttonTitle?: string;
  /** Landing URL when the Kakao card / button is tapped (viewer page). */
  linkUrl?: string;
};

export async function sendKakaoFeedShare(opts: KakaoFeedShareOptions): Promise<void> {
  const Kakao = await ensureKakaoReady();

  const title = clampText(opts.title || "Studio Canvas AI", 40);
  const description = clampText(opts.description || "Studio Canvas AI", 80);
  const buttonTitle = clampText(opts.buttonTitle || "이미지 보기", 14);
  const imageUrl =
    opts.imageUrl && isKakaoCdnImageUrl(opts.imageUrl)
      ? opts.imageUrl
      : opts.imageUrl === FALLBACK_SHARE_IMAGE
        ? FALLBACK_SHARE_IMAGE
        : opts.imageUrl?.startsWith("https://www.studio-canvas-ai.com/")
          ? opts.imageUrl
          : FALLBACK_SHARE_IMAGE;

  const landing =
    opts.linkUrl &&
    (opts.linkUrl.startsWith("https://www.studio-canvas-ai.com/") ||
      opts.linkUrl.startsWith("https://studio-canvas-ai.com/") ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(opts.linkUrl))
      ? opts.linkUrl
      : SHARE_LINK;

  const payload = {
    objectType: "feed",
    content: {
      title,
      description,
      imageUrl,
      link: {
        mobileWebUrl: landing,
        webUrl: landing,
      },
    },
    buttons: [
      {
        title: buttonTitle,
        link: {
          mobileWebUrl: landing,
          webUrl: landing,
        },
      },
    ],
    installTalk: true,
  };

  dbg("before-sendDefault", [
    `imageHost=${imageUrl.slice(0, 48)}`,
    `landing=${landing.slice(0, 64)}`,
  ]);
  Kakao.Share!.sendDefault(payload);
  dbg("after-sendDefault");
}

export async function shareImageViaKakao(opts: {
  file?: File | null;
  publicImageUrl?: string | null;
  title: string;
  description: string;
  linkUrl?: string;
  buttonTitle?: string;
}): Promise<"kakao" | "unavailable"> {
  dbg("shareImageViaKakao-enter", [`hasFile=${Boolean(opts.file)}`]);

  let imageUrl = FALLBACK_SHARE_IMAGE;

  if (opts.file) {
    try {
      imageUrl = await uploadImageToKakao(opts.file);
      dbg("uploadImage-ok");
    } catch (err) {
      console.warn("[kakaoShare] uploadImage failed; using site fallback image", err);
      dbg("uploadImage-failed", [String(err)]);
    }
  } else if (
    opts.publicImageUrl?.startsWith("https://www.studio-canvas-ai.com/") ||
    (opts.publicImageUrl && isKakaoCdnImageUrl(opts.publicImageUrl))
  ) {
    imageUrl = opts.publicImageUrl;
  }

  await sendKakaoFeedShare({
    title: opts.title,
    description: opts.description,
    imageUrl,
    buttonTitle: opts.buttonTitle,
    linkUrl: opts.linkUrl,
  });
  return "kakao";
}
