/**
 * Smoke tests for terms-consent redirect guards.
 * Run: node scripts/verify-terms-consent.mjs
 *
 * Mirrors lib/termsConsent.ts — keep in sync when changing path rules.
 */

function normalizeAppPathname(pathname) {
  if (!pathname) return "/";
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function safePostConsentPath(raw, fallback = "/") {
  if (!raw || typeof raw !== "string") return fallback;
  let path = raw.trim();
  if (path.startsWith("https://") || path.startsWith("http://")) {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  const pathnameOnly = normalizeAppPathname(path.split(/[?#]/)[0] || "/");
  if (
    pathnameOnly === "/terms-consent" ||
    pathnameOnly.startsWith("/api/") ||
    pathnameOnly === "/api" ||
    pathnameOnly.startsWith("/auth/") ||
    pathnameOnly === "/auth"
  ) {
    return fallback;
  }
  return path;
}

function isTermsConsentExempt(pathname) {
  const p = normalizeAppPathname(pathname);
  if (p === "/api" || p.startsWith("/api/")) return true;
  if (p === "/auth" || p.startsWith("/auth/")) return true;
  if (p === "/terms-consent") return true;
  if (p === "/terms" || p === "/privacy") return true;
  if (p === "/admin" || p.startsWith("/admin/")) return true;
  return false;
}

function buildTermsConsentUrl(nextPath) {
  const next = safePostConsentPath(nextPath);
  return `/terms-consent?next=${encodeURIComponent(next)}`;
}

const tests = [
  ["normalize trailing", normalizeAppPathname("/terms-consent/") === "/terms-consent"],
  ["exempt /terms-consent/", isTermsConsentExempt("/terms-consent/") === true],
  ["exempt /terms", isTermsConsentExempt("/terms") === true],
  ["not exempt /generate", isTermsConsentExempt("/generate") === false],
  ["block next=/terms-consent", safePostConsentPath("/terms-consent") === "/"],
  ["block next=/auth/bridge", safePostConsentPath("/auth/bridge") === "/"],
  ["allow /", safePostConsentPath("/") === "/"],
  ["allow /generate", safePostConsentPath("/generate") === "/generate"],
  ["allow /gallery/my?x=1", safePostConsentPath("/gallery/my?x=1") === "/gallery/my?x=1"],
  ["block //evil", safePostConsentPath("//evil.com") === "/"],
  [
    "reject absolute URLs",
    safePostConsentPath("https://evil.com/phish") === "/",
  ],
  [
    "buildTermsConsentUrl no nest",
    buildTermsConsentUrl("/terms-consent") === "/terms-consent?next=%2F",
  ],
  [
    "middleware loop case",
    !(
      isTermsConsentExempt("/terms-consent/") === false &&
      safePostConsentPath("/terms-consent/") === "/terms-consent/"
    ),
  ],
];

let failed = 0;
for (const [name, ok] of tests) {
  if (!ok) {
    console.error("FAIL:", name);
    failed += 1;
  } else {
    console.log("ok:", name);
  }
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\nAll ${tests.length} passed`);
