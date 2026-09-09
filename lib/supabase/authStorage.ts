import { getSupabaseUrl, RETIRED_SUPABASE_PROJECT_REFS } from "@/lib/supabase/config";

const PROJECT_REF_MARKER = "sca_supabase_project_ref";

/** Extract hosted project ref from https://<ref>.supabase.co */
export function getSupabaseProjectRef(
  url = getSupabaseUrl()
): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host.endsWith(".supabase.co") && !host.endsWith(".supabase.in")) {
      return undefined;
    }
    const ref = host.split(".")[0] ?? "";
    return ref.length >= 10 ? ref : undefined;
  } catch {
    return undefined;
  }
}

/** Canonical auth storage / cookie name for the active project. */
export function getSupabaseAuthStorageKey(
  ref = getSupabaseProjectRef()
): string | undefined {
  return ref ? `sb-${ref}-auth-token` : undefined;
}

function removeMatchingStorageKeys(
  storage: Storage,
  shouldRemove: (key: string) => boolean
) {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && shouldRemove(key)) doomed.push(key);
  }
  for (const key of doomed) {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function clearDocumentCookie(name: string) {
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  const variants = [
    `${name}=; Max-Age=0; path=/; SameSite=Lax`,
    `${name}=; expires=${expires}; path=/; SameSite=Lax`,
  ];
  try {
    const host = window.location.hostname;
    if (host.includes(".")) {
      variants.push(
        `${name}=; Max-Age=0; path=/; domain=${host}; SameSite=Lax`,
        `${name}=; Max-Age=0; path=/; domain=.${host}; SameSite=Lax`
      );
      const parts = host.split(".");
      if (parts.length >= 2) {
        const root = parts.slice(-2).join(".");
        variants.push(
          `${name}=; Max-Age=0; path=/; domain=.${root}; SameSite=Lax`
        );
      }
    }
  } catch {
    /* ignore */
  }
  for (const value of variants) {
    try {
      document.cookie = value;
    } catch {
      /* ignore */
    }
  }
}

/**
 * Drop auth residue that does not belong to `currentRef`.
 * When the active project changes, wipe all Supabase auth keys once.
 */
export function purgeStaleSupabaseAuthStorage(
  currentRef = getSupabaseProjectRef()
): { purged: boolean; projectChanged: boolean } {
  if (typeof window === "undefined" || !currentRef) {
    return { purged: false, projectChanged: false };
  }

  let previous: string | null = null;
  try {
    previous = localStorage.getItem(PROJECT_REF_MARKER);
  } catch {
    previous = null;
  }
  const projectChanged = Boolean(previous && previous !== currentRef);

  const isForeignOrLegacy = (key: string) => {
    const k = key.toLowerCase();
    if (k === PROJECT_REF_MARKER) return false;
    // Legacy default keys from older supabase-js builds
    if (k === "supabase.auth.token" || k.startsWith("supabase.auth.")) {
      return true;
    }
    if (!k.startsWith("sb-")) return false;
    // Always drop auth cookies/keys from retired test projects.
    for (const retired of RETIRED_SUPABASE_PROJECT_REFS) {
      if (k.startsWith(`sb-${retired}-`)) return true;
    }
    if (projectChanged) return true;
    // Keep only keys for the active project (auth-token, code-verifier chunks, …)
    return !k.startsWith(`sb-${currentRef.toLowerCase()}-`);
  };

  try {
    removeMatchingStorageKeys(localStorage, isForeignOrLegacy);
  } catch {
    /* ignore */
  }
  try {
    removeMatchingStorageKeys(sessionStorage, isForeignOrLegacy);
  } catch {
    /* ignore */
  }

  try {
    for (const raw of document.cookie.split(";")) {
      const name = raw.split("=")[0]?.trim();
      if (!name) continue;
      if (isForeignOrLegacy(name)) clearDocumentCookie(name);
    }
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(PROJECT_REF_MARKER, currentRef);
  } catch {
    /* ignore */
  }

  return { purged: true, projectChanged };
}

let didBootstrapPurge = false;

/** Idempotent purge before first browser client creation / OAuth. */
export function ensureSupabaseAuthStorageReady(): {
  ref: string | undefined;
  projectChanged: boolean;
} {
  const ref = getSupabaseProjectRef();
  if (!ref || typeof window === "undefined") {
    return { ref, projectChanged: false };
  }
  if (!didBootstrapPurge) {
    const { projectChanged } = purgeStaleSupabaseAuthStorage(ref);
    didBootstrapPurge = true;
    return { ref, projectChanged };
  }
  return { ref, projectChanged: false };
}
