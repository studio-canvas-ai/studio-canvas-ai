/**
 * Full_Source_Code_v11.txt — zero-loss source dump + master architecture blueprint.
 *
 * Merges:
 *   - Reusable Blueprint (OAuth / async safety / mobile–desktop UX / Shorts dual studio / YouTube Data API)
 *   - Integration_Log_v1…v8 (Kakao share, Naver, Google, Meta, Instagram, Microsoft, YouTube, Kakao login)
 *   - Production source under app/, components/, lib/, scripts/, types/, public/, supabase/
 *   - Root config (middleware, package.json, next/tailwind/tsconfig, .env.example, …)
 *
 * Run: node scripts/export-full-source-v11.mjs
 */
import { createWriteStream, existsSync, readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative, sep } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "Full_Source_Code_v11.txt");

const INCLUDE_DIRS = ["app", "components", "lib", "scripts", "types", "public", "supabase", "docs"];
const INCLUDE_ROOT_FILES = [
  "middleware.ts",
  "middleware.js",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "tsconfig.json",
  "tailwind.config.ts",
  "tailwind.config.js",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.cjs",
  "eslint.config.mjs",
  "eslint.config.js",
  ".eslintrc.json",
  "vercel.json",
  "components.json",
  ".env.example",
  "README.md",
  "next-env.d.ts",
];

const INTEGRATION_LOGS = [
  "Integration_Log_v1.txt",
  "Integration_Log_v2.txt",
  "Integration_Log_v3.txt",
  "Integration_Log_v4.txt",
  "Integration_Log_v5.txt",
  "Integration_Log_v6.txt",
  "Integration_Log_v7.txt",
  "Integration_Log_v8.txt",
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".vercel",
  "coverage",
  ".turbo",
  ".data",
  ".temp",
  "agent-transcripts",
  "tmp-imgcheck",
]);

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".pdf",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".eot",
  ".mp4",
  ".mp3",
  ".wav",
  ".zip",
  ".gz",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".bin",
  ".wasm",
  ".svgz",
  ".psd",
  ".ai",
  ".sketch",
  ".fig",
]);

const SKIP_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
  "tsconfig.tsbuildinfo",
]);

function toPosix(p) {
  return p.split(sep).join("/");
}

function shouldSkipFile(name) {
  if (SKIP_FILE_NAMES.has(name)) return true;
  if (name.startsWith(".env.") && name !== ".env.example") return true;
  if (name.startsWith("Full_Source_Code")) return true;
  if (name.startsWith("Integration_Log_")) return true; // appended in dedicated section
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot >= 0 && BINARY_EXT.has(lower.slice(dot))) return true;
  return false;
}

function isProbablyBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function walk(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldSkipFile(entry.name)) continue;
    out.push(full);
  }
}

/** Master reusable blueprint — written as first archive section (full text, no ellipsis). */
const MASTER_BLUEPRINT = `# Studio Canvas AI — Master Reusable Blueprint (v11)

> Enterprise reconstruction guide. Pair with Integration_Log_v1…v8 and the zero-loss source dump below.
> Generated for Full_Source_Code_v11.txt
> Format inherited from Full_Source_Code_v10.txt

---

## A. System context

Studio Canvas AI is a Next.js (App Router) product on Vercel:

- **Auth**: Supabase Auth (primary OAuth) → \`/auth/callback\` (PKCE) → \`/auth/bridge\` → NextAuth JWT + app credit user DB
- **IdPs**: Google (built-in), Kakao (built-in), Facebook/Instagram (Meta unified \`facebook\`), Microsoft (\`custom:microsoft\`), Naver (\`custom:naver\` + userinfo flatten proxy)
- **Share / publish**: Kakao Talk JS SDK share (\`lib/kakaoShare.ts\`); YouTube Shorts = Google OAuth + Data API v3 upload (\`lib/shortsYoutubeUpload.ts\`, \`app/api/shorts/youtube/*\`) with Studio-assist fallback
- **UX**: Mobile app-shell (slim Navbar + \`BottomTabBar\` + accordion footer \`pb-24\`); Desktop horizontal nav + multi-column footer; Shorts hybrid dual studio as a full-page editor (\`/shorts/studio\`)

Canonical production origin: \`https://www.studio-canvas-ai.com\`  
Supabase project (example): \`https://oorujqbivznftsyqilyj.supabase.co\`  
Provider callback (all social IdPs): \`https://<project-ref>.supabase.co/auth/v1/callback\`

---

## B. OAuth 2.0 / OpenID Connect — unified pipeline

### B.1 Token exchange topology (all providers)

\`\`\`
[UI AuthModal]
  → signInWith*(nextPath)
  → supabase.auth.signInWithOAuth({ provider, options: { redirectTo, scopes? } })
       │
       ▼
[IdP authorize]  redirect_uri = Supabase /auth/v1/callback
       │
       ▼
[Supabase GoTrue]  code → token (+ optional userinfo) → auth.users
       │  redirectTo = https://www…/auth/callback?next=…
       ▼
[App middleware]  if Site URL (/) receives ?code= → forward /auth/callback
       ▼
[App /auth/callback]  exchangeSupabaseCode (PKCE) → cookies sb-<ref>-auth-token
       ▼
[App /auth/bridge]  getSession (retry) → POST /api/auth/supabase-bridge
       ▼
[NextAuth JWT + lib/db credits user + optional terms-consent]
\`\`\`

**Rule:** IdP Redirect URI is **always** Supabase callback — never the site \`/auth/callback\` and never Auth.js \`/api/auth/callback/*\` for the primary path.

### B.2 Provider matrix

| UI | Supabase provider | Scopes (app) | Special |
|----|-------------------|--------------|---------|
| Google | \`google\` | \`openid email profile\` + \`prompt=select_account\` | First-class; storage purge before OAuth |
| Naver | \`custom:naver\` | \`profile\` only (**no openid**) | Nested \`/v1/nid/me\` → flatten proxy (Edge or \`/api/auth/naver/userinfo\`) |
| Kakao | \`kakao\` | default | REST key + secret in Dashboard; Allow users without email |
| Facebook | \`facebook\` | **omit email scope** until Meta Use case grants | App ID 1527934262363418 |
| Instagram | **same \`facebook\`** | same | \`signInWithInstagram = signInWithFacebook\`; never \`custom:instagram\` |
| Microsoft | \`custom:microsoft\` | \`openid profile email offline_access\` | All Entra URLs use tenant **\`common\`** (avoid AADSTS70016) |

### B.3 Key files

- \`components/AuthModal.tsx\` — buttons / busy / errors
- \`lib/supabase/oauth.ts\` — \`signInWith*\`, \`extractSupabaseOAuthProfile\`, \`buildAuthCallbackRedirectTo\`
- \`lib/supabase/naver-userinfo.ts\` + \`app/api/auth/naver/userinfo/route.ts\` + \`supabase/functions/naver-userinfo\`
- \`app/auth/callback/route.ts\`, \`lib/supabase/exchange.ts\`, \`app/auth/bridge/*\`
- \`app/api/auth/supabase-bridge/route.ts\`
- \`lib/supabase/authStorage.ts\` — purge foreign project PKCE keys
- \`lib/auth.ts\` — Auth.js fallbacks only
- \`middleware.ts\` — root \`?code=\` forward
- \`supabase/README.md\`, \`.env.example\`

### B.4 Profile normalization pattern

\`extractSupabaseOAuthProfile(user)\`:

- Prefer \`user.email\` → metadata → identity_data
- Synthetic emails when consent missing: \`@users.naver.id\`, \`@users.kakao.id\`, \`@users.facebook.id\`
- Local row key = Supabase \`user.id\` (UUID) as \`providerAccountId\`

### B.5 Reconstruction checklist (new project)

1. Create Supabase project; set \`NEXT_PUBLIC_SUPABASE_URL\` + anon key; \`AUTH_SECRET\`; site URL
2. Register each IdP Redirect = \`https://<ref>.supabase.co/auth/v1/callback\`
3. Enable providers (Google/Kakao/Facebook built-in; Custom microsoft + naver)
4. Naver: deploy userinfo flatten with \`verify_jwt=false\`
5. Microsoft: Entra multi-tenant+MSA; Dashboard URLs all \`/common/\`
6. Meta: no \`scopes: "email"\` until approved; Instagram UI → facebook
7. Implement callback → bridge → app session
8. Start OAuth on **www** (PKCE cookie host match)

Detailed per-provider guides: Integration_Log_v2 (Kakao share), v3 (Naver), v4 (Google), v5 (Facebook), v6 (Instagram), v7 (Microsoft).

---

## C. Async external I/O — infinite-loading prevention

### C.1 Principles

1. **Every** user-triggered async path: \`try / catch / finally\` with busy flag cleared in \`finally\`
2. Separate busy flags per action (\`kakaoBusy\` vs \`youtubeBusy\`) — one hang must not block another
3. Prefer timeouts (\`AbortController\` / \`Promise.race\`) on export/fetch that can stall
4. Do not await APIs that never settle (e.g. some Web Share implementations) without timeout/fallback
5. Bridge: bounded session retries + fetch timeout (\`FETCH_TIMEOUT_MS\`)

### C.2 Patterns used in this codebase

**Share / export (ThumbnailEditor, webShare, kakaoShare)**

\`\`\`ts
setYoutubeBusy(true);
try {
  const blob = await exportWithTimeout(exportBlob, 8_000);
  // download + open external studio — do NOT hang on navigator.share
} catch (e) {
  console.error(e);
  showFallback();
} finally {
  setYoutubeBusy(false);
}
\`\`\`

**OAuth buttons (AuthModal)**

- On error: \`setBusy(false)\` + UI message
- On success redirect: leave busy true (navigation unmounts modal)
- Always \`console.error\` with provider-prefixed tag

**Auth bridge**

- Retry \`getSession\` a few times (Meta/mobile cookie race)
- Abort \`/api/auth/supabase-bridge\` after timeout → \`failRedirect\`

**Generate / credits**

- Server debit + client spend API fallback
- Restore credits on pipeline failure when debit meta present

### C.3 Anti-patterns

- Busy flag set true without \`finally\`
- Awaiting \`navigator.share()\` with no timeout
- Shared single \`loading\` for unrelated buttons
- Swallowing errors without user-visible recovery

Thumbnail YouTube share (image path): download JPG + open Studio — see Integration_Log_v1 / \`docs/youtube-share-guide.md\`.

Shorts YouTube publish (video path): Data API v3 — see section I below.

---

## D. Mobile app-shell vs desktop studio layout

### D.1 Breakpoint contract

- Tailwind \`md:\` (~768px) is the primary mobile/desktop split
- Mobile: compact chrome + bottom tabs + accordion footer + content \`pb-24\` clearance
- Desktop: full horizontal Navbar, multi-column footer, no bottom tab bar

### D.2 Key components

| Piece | File | Behavior |
|-------|------|----------|
| Slim mobile header | \`components/Navbar.tsx\` | \`md:hidden\` h-12 bar; \`hidden md:flex\` full nav |
| Bottom tabs | \`components/BottomTabBar.tsx\` | Fixed bottom; routes \`/\`, \`/styles\`, \`/gallery/my\`, \`/pricing\`, \`/profile\` |
| Accordion footer | \`components/FooterClient.tsx\` | \`md:hidden\` accordion; \`hidden md:grid\` columns; \`pb-24 md:pb-0\` |
| Grids | Style/gallery | \`grid-cols-2 sm:… md:grid-cols-3 xl:grid-cols-4\` |

### D.3 Reconstruction pattern

\`\`\`tsx
// Navbar sketch
<nav className="… md:hidden">{/* logo + credits + auth */}</nav>
<nav className="hidden md:flex">{/* full links */}</nav>
<BottomTabBar /> // internally hidden from md up

// Footer sketch
<footer className="… pb-24 md:pb-0">
  <div className="md:hidden">{/* accordion sections */}</div>
  <div className="hidden md:grid md:grid-cols-5">{/* desktop columns */}</div>
</footer>
\`\`\`

### D.4 UX rules

- One job per mobile viewport chrome: tabs for primary destinations only
- Do not duplicate full desktop link lists in the slim header
- Keep tab bar above safe-area; footer padding prevents occlusion
- Studio workflows (\`/generate\`) stay full-width; chrome remains consistent via Navbar mount
- Shorts dual studio (\`/shorts/studio\`) is a **full-page shell** (\`fixed inset-0\`, \`100dvh\`): no Navbar/Footer; back arrow returns to the hook-frame step

---

## E. Kakao Talk share (not login)

- \`lib/kakaoShare.ts\`: on-demand SDK, hardcoded JS key chunks, reuse init, conditional cleanup
- Errors 4011 / -401: key whitespace/typo (\`50fa\` not \`50af\`), domain registration, cleanup-every-click
- Login Kakao uses REST key in Supabase — separate from JS share key
- See Integration_Log_v2.txt

---

## F. Environment & secrets standard

| Secret class | Where |
|--------------|--------|
| IdP Client Secrets | Supabase Dashboard providers (primary) |
| \`AUTH_SECRET\` | Vercel / server env |
| \`NEXT_PUBLIC_SUPABASE_*\` | Public |
| \`GOOGLE_*\` / \`NAVER_*\` / \`KAKAO_*\` / \`FACEBOOK_*\` / \`MICROSOFT_*\` | Auth.js fallback only when Supabase path off |
| \`.env\` / \`.env.local\` | **Never** commit; dump excludes them |
| \`.env.example\` | Safe templates — included in this archive |

Redeploy after changing any \`NEXT_PUBLIC_*\`.

---

## G. How to use this archive

1. Read sections A–F for architecture decisions
2. Read Integration_Log_v1…v7 for provider-specific troubleshooting
3. Extract FILE PATH sections into a fresh repo tree (preserve relative paths)
4. Copy \`.env.example\` → \`.env.local\`; fill secrets in Vercel + IdP consoles
5. \`npm ci\` && \`npm run build\`
6. Configure Supabase Redirect URLs + each IdP callback to Supabase
7. Deploy Vercel; verify each social button + Kakao share + mobile tab chrome

---

## H. Archive manifest notes

- Zero-loss: full file bodies, no \`// … existing code\` ellipsis
- Excluded: \`node_modules\`, \`.next\`, \`.git\`, \`dist\`, \`build\`, binary media, \`.env*\` secrets
- Included text assets under \`public/\` (e.g. SVG, \`manifest.json\`)
- This blueprint file path in the dump: \`_ARCHITECTURE/00_MASTER_BLUEPRINT.md\`

---

## I. YouTube Shorts upload (Data API v3)

Hybrid Dual Studio publishes the mixed Shorts file through Google OAuth + YouTube Data API, with Studio-assist fallback when the API path is unavailable.

### I.1 Topology

\`\`\`
[ShortsFullStudio YouTube panel]
  → GET /api/shorts/youtube/status
  → if disconnected: GET /api/shorts/youtube/connect  (Google OAuth, youtube.upload)
       │  callback: /api/shorts/youtube/callback
       ▼
  POST /api/shorts/youtube/prepare   (title / thumb bind / mode: api | assist)
  POST /api/shorts/youtube/upload    (multipart or resumable PUT)
       │
       ▼
  YouTube Data API v3 videos.insert
       │  fallback
       ▼
  open YouTube Studio upload URL (assist mode)
\`\`\`

### I.2 Key files

- \`lib/shortsYoutubeUpload.ts\` — client helpers, privacy, prepare/upload types
- \`app/api/shorts/youtube/connect/route.ts\`
- \`app/api/shorts/youtube/callback/route.ts\`
- \`app/api/shorts/youtube/status/route.ts\`
- \`app/api/shorts/youtube/disconnect/route.ts\`
- \`app/api/shorts/youtube/prepare/route.ts\`
- \`app/api/shorts/youtube/upload/route.ts\`
- \`components/ShortsFullStudio.tsx\` — connect / privacy / progress / try-catch-finally busy flags

### I.3 Async safety

- Separate \`youtubeBusy\` from caption/export busy flags
- Always clear busy in \`finally\`
- Direct upload capped vs resumable PUT above Vercel body limit (\`DIRECT_UPLOAD_MAX_BYTES\`)
- Assist fallback must not hang on \`navigator.share\`

---

## J. Hybrid Dual Studio (full-page editor)

\`/shorts/studio\` is a production full-page editor, not a floating window.

| Concern | Implementation |
|---------|----------------|
| Shell | \`ShortsFullStudio\` \`fixed inset-0\` + \`100dvh\`; \`app/shorts/studio/page.tsx\` owns the viewport (no Navbar/Footer) |
| Layout | Sticky bottom transport; \`gridTemplateRows: minmax(0, 1fr) auto\`; root \`overflow-hidden\` |
| Dual screens | \`activeScreenId\` \`'left'\` (video) / \`'right'\` (thumbnail); independent \`videoScale\`/\`videoPosY\` vs \`thumbScale\`/\`thumbPosY\` |
| Pan | Pointer drag scoped per preview container |
| Text layers | Per-layer auto-resize textareas; \`boxColor\` + \`TEXT_BOX_BG_COLORS\` in preview and export |
| Style pickers | \`components/StudioStylePickers.tsx\` — portal emoji grid (symbols only, opens downward) + horizontal background-color dropdown; 11 text swatches always visible (black first) |
| Export | \`lib/shortsStudioExport.ts\` draws \`hexToRgba(layer.boxColor, opacity)\` |

Do **not** restore \`FloatingStudioWindow\` — it was removed after layout collapse.

---

## K. Reconstruction extras (v11)

1. Copy FILE PATH sections into a fresh tree (same relative paths)
2. \`npm ci\` && fill \`.env.local\` from \`.env.example\` (never copy real \`.env\`)
3. Configure Supabase IdP callbacks + YouTube Google OAuth client for Data API
4. Verify: social login matrix, Kakao share, mobile bottom tabs, \`/shorts/studio\` dual screens, YouTube connect/upload, template-studio emoji/color pickers
`;

function writeSection(stream, relPath, content) {
  stream.write("================================================\n");
  stream.write(`FILE PATH: ${relPath}\n`);
  stream.write("================================================\n");
  stream.write(content);
  if (!content.endsWith("\n")) stream.write("\n");
  stream.write("\n");
}

function writeFileFromDisk(stream, full) {
  const rel = toPosix(relative(ROOT, full));
  let buf;
  try {
    buf = readFileSync(full);
  } catch {
    return { ok: false, binary: true };
  }
  if (isProbablyBinary(buf)) return { ok: false, binary: true };
  writeSection(stream, rel, buf.toString("utf8"));
  return { ok: true, binary: false };
}

const files = [];
for (const dir of INCLUDE_DIRS) {
  walk(join(ROOT, dir), files);
}
for (const name of INCLUDE_ROOT_FILES) {
  const full = join(ROOT, name);
  if (existsSync(full) && statSync(full).isFile() && !shouldSkipFile(name)) {
    files.push(full);
  }
}

const unique = [...new Set(files)];
unique.sort((a, b) => toPosix(relative(ROOT, a)).localeCompare(toPosix(relative(ROOT, b))));

const stream = createWriteStream(OUT, { encoding: "utf8" });
let written = 0;
let skippedBinary = 0;

stream.write(`# Studio Canvas AI — Full Source Code Dump (v11)\n`);
stream.write(
  `# Zero-loss production sources + Master Reusable Blueprint (OAuth / async safety / mobile UX / Dual Studio / YouTube API)\n`
);
stream.write(`# + Integration_Log_v1…v8 (Google, Naver, Kakao share/login, Meta, Instagram, Microsoft, YouTube)\n`);
stream.write(`# Generated: ${new Date().toISOString()}\n`);
stream.write(`# Root: ${ROOT}\n`);
stream.write(`# Generator: scripts/export-full-source-v11.mjs\n\n`);

writeSection(stream, "_ARCHITECTURE/00_MASTER_BLUEPRINT.md", MASTER_BLUEPRINT);
written++;

writeSection(
  stream,
  "_ARCHITECTURE/01_INDEX.md",
  `# Architecture index (v11)

| Section / Log | Topic |
|---------------|--------|
| \`_ARCHITECTURE/00_MASTER_BLUEPRINT.md\` | Unified OAuth, async safety, mobile/desktop UX, Dual Studio, YouTube Data API |
| \`Integration_Log_v1.txt\` | YouTube thumbnail share (download + Studio) |
| \`Integration_Log_v2.txt\` | Kakao Talk share (JS SDK, 4011, init reuse) |
| \`Integration_Log_v3.txt\` | Naver OAuth (\`custom:naver\`, userinfo flatten) |
| \`Integration_Log_v4.txt\` | Google OAuth (Supabase built-in, select_account) |
| \`Integration_Log_v5.txt\` | Facebook / Meta Graph login path |
| \`Integration_Log_v6.txt\` | Instagram CTA → Facebook Login unified |
| \`Integration_Log_v7.txt\` | Microsoft Entra (\`custom:microsoft\`, common tenant) |
| \`Integration_Log_v8.txt\` | Kakao OAuth login (built-in \`kakao\`, KOE006/KOE205) |
| \`docs/youtube-share-guide.md\` | YouTube operational guide (if present) |

Primary source trees follow below as FILE PATH sections.
`
);
written++;

for (const name of INTEGRATION_LOGS) {
  const full = join(ROOT, name);
  if (!existsSync(full)) {
    console.warn(`Missing ${name} — skipping`);
    continue;
  }
  const result = writeFileFromDisk(stream, full);
  if (result.ok) written++;
  else skippedBinary++;
}

for (const full of unique) {
  const result = writeFileFromDisk(stream, full);
  if (result.ok) written++;
  else skippedBinary++;
}

await new Promise((resolve, reject) => {
  stream.end(() => resolve());
  stream.on("error", reject);
});

const sizeMb = (statSync(OUT).size / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${OUT}`);
console.log(`Files included: ${written}`);
console.log(`Skipped binary/unreadable: ${skippedBinary}`);
console.log(`Size: ${sizeMb} MB`);
