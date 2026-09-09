/**
 * Logout purge for editor / wizard ephemeral client caches.
 * Removes prompts, session drafts, and pending project blobs from
 * localStorage + sessionStorage. Does not wipe account vault/recent
 * cloud caches (those stay keyed under protected studio prefixes that
 * are not listed here as exact editor session keys).
 */

import { PRINT_UNIFIED_EDITOR_SESSION_KEY } from "@/lib/printUnifiedEditor";
import { PRINT_WIZARD_SESSION_KEY } from "@/lib/printWizardTypes";
import {
  PHOTO_PENDING_PROJECT_KEY,
  PRINT_PENDING_PROJECT_KEY,
} from "@/lib/wizard/wizardProduct";
import { PHOTO_WIZARD_SESSION_KEY } from "@/lib/photoWizardSession";
import {
  TEMPLATE_01_CUSTOM_KEY,
  TEMPLATE_01_REMOVED_KEY,
  TEMPLATE_WAREHOUSE_PENDING_KEY,
} from "@/lib/templateWarehouse";
import {
  SPACE4_ADMIN_REVIEW_KEY,
} from "@/lib/space4AdminReview";
import { RESULT_SESSION_KEY } from "@/lib/resultSession";
import { STORAGE_KEYS } from "@/lib/storage";
import { SESSION_LOCK_STORAGE_KEY } from "@/lib/auth/sessionLockShared";

/** Fired after editor caches are wiped so mounted editors can reset in-memory state. */
export const EDITOR_CACHE_CLEARED_EVENT = "sca:editor-cache-cleared";

const EXACT_KEYS = [
  PRINT_UNIFIED_EDITOR_SESSION_KEY,
  PRINT_WIZARD_SESSION_KEY,
  "sca_print_wizard_v4",
  "sca_print_wizard_v3",
  "sca_print_wizard_drafts_v1",
  PHOTO_WIZARD_SESSION_KEY,
  "sca_photo_wizard_drafts_v1",
  PRINT_PENDING_PROJECT_KEY,
  PHOTO_PENDING_PROJECT_KEY,
  TEMPLATE_WAREHOUSE_PENDING_KEY,
  TEMPLATE_01_CUSTOM_KEY,
  TEMPLATE_01_REMOVED_KEY,
  SPACE4_ADMIN_REVIEW_KEY,
  RESULT_SESSION_KEY,
  "sca_shorts_studio_v1",
  "sca_shorts_pending_project_v1",
  "sca_selected_result_v1",
  "sca_train_selection_v1",
  "sca_plan_usage_v2",
  "sca_plan_usage_v1",
  STORAGE_KEYS.accountMeta,
  SESSION_LOCK_STORAGE_KEY,
] as const;

/** Prefixes for ephemeral editor / AI prompt / pending session data. */
const EDITOR_KEY_PREFIXES = [
  "sca_print_",
  "sca_photo_wizard",
  "sca_photo_pending",
  "sca_pending_",
  "sca_warehouse_",
  "sca_space4_",
  "sca_result_",
  "sca_selected_result",
  "sca_train_selection",
  "sca_shorts_studio",
  "sca_shorts_pending",
  "sca_plan_usage",
  "sca_ai_",
  "sca_bg_",
  "sca_prompt_",
] as const;

/** Keep these even during a broad sessionStorage sweep. */
const SESSION_KEEP = new Set([
  "sca_auth_next",
  "studio-canvas-locale",
]);

function shouldClearEditorKey(key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  if ((EXACT_KEYS as readonly string[]).includes(k)) return true;
  const lower = k.toLowerCase();
  for (const prefix of EDITOR_KEY_PREFIXES) {
    if (lower.startsWith(prefix.toLowerCase())) return true;
  }
  // Unified / wizard session leftovers
  if (lower.includes("wizard") && lower.startsWith("sca_")) return true;
  if (lower.includes("print_unified") || lower.includes("print-unified")) {
    return true;
  }
  return false;
}

function removeMatchingKeys(
  storage: Storage,
  predicate: (key: string) => boolean
) {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && predicate(key)) doomed.push(key);
  }
  for (const key of doomed) {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Wipe editor-related client caches on logout.
 * Prefer targeted removal over Storage.clear() so locale / partner / vault
 * indices are not destroyed — but remove every known editor session key.
 */
export function clearEditorClientCachesOnLogout(): void {
  if (typeof window === "undefined") return;

  try {
    for (const key of EXACT_KEYS) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  try {
    removeMatchingKeys(window.localStorage, shouldClearEditorKey);
  } catch {
    /* ignore */
  }

  try {
    // Session storage is ephemeral work state — clear editor keys aggressively.
    removeMatchingKeys(
      window.sessionStorage,
      (key) => !SESSION_KEEP.has(key) && shouldClearEditorKey(key)
    );
    // Also drop any remaining sca_* session drafts except keep-list.
    removeMatchingKeys(window.sessionStorage, (key) => {
      if (SESSION_KEEP.has(key)) return false;
      const lower = key.toLowerCase();
      return (
        lower.startsWith("sca_") &&
        !lower.startsWith("sb-") &&
        !lower.includes("auth")
      );
    });
  } catch {
    /* ignore */
  }

  try {
    // Reset in-memory Konva canvas store if the module is loaded.
    void import("@/lib/canvas/canvasStore")
      .then(({ useCanvasStore }) => {
        useCanvasStore.getState().resetDocument();
        useCanvasStore.getState().select(null);
        useCanvasStore.getState().setEditingTextId(null);
      })
      .catch(() => {
        /* ignore */
      });
  } catch {
    /* ignore */
  }

  try {
    window.dispatchEvent(new CustomEvent(EDITOR_CACHE_CLEARED_EVENT));
  } catch {
    /* ignore */
  }
}
