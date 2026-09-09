/**
 * Debounced cloud push after local mutations. Dynamic import avoids cycles
 * between recentProjects / photoVaultStorage and the recovery client.
 */

let timer: ReturnType<typeof setTimeout> | null = null;
let suppressSync = 0;

export function withoutStudioStoreSync<T>(fn: () => T): T {
  suppressSync += 1;
  try {
    return fn();
  } finally {
    suppressSync -= 1;
  }
}

export function scheduleStudioStoreSync(delayMs = 400): void {
  if (typeof window === "undefined") return;
  if (suppressSync > 0) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void import("@/lib/studioStore/clientRecovery")
      .then((m) => m.pushLocalStoresToServer())
      .catch((err) => {
        console.warn("[studioStore] cloud sync failed", err);
      });
  }, delayMs);
}
