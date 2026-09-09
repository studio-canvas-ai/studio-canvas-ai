/**
 * Template 04 admin manual review — load into Screen 26, edit, publish to Template 03.
 */

import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import {
  parseStudioProject,
  stashPendingStudioProject,
  takePendingStudioProject,
} from "@/lib/canvas/projectFile";
import { importSecureProject } from "@/lib/projectStorage";

export const SPACE4_ADMIN_REVIEW_KEY = "sca_space4_admin_review_v1";
export const SPACE4_ADMIN_REVIEW_PROJECT_KEY = "print_unified_editor";
export const SPACE4_ADMIN_REVIEW_APPLY_EVENT = "sca:space4-admin-review-apply";

export type Space4AdminReviewSession = {
  space4Id: string;
  label: string;
  startedAt: number;
};

export function stashSpace4AdminReview(session: Space4AdminReviewSession) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SPACE4_ADMIN_REVIEW_KEY, JSON.stringify(session));
}

export function getSpace4AdminReview(): Space4AdminReviewSession | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(SPACE4_ADMIN_REVIEW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Space4AdminReviewSession;
    if (!parsed?.space4Id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSpace4AdminReview() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SPACE4_ADMIN_REVIEW_KEY);
}

export function stashSpace4ReviewProject(project: StudioCanvasProjectV1) {
  stashPendingStudioProject(project, SPACE4_ADMIN_REVIEW_PROJECT_KEY);
}

export function takeSpace4ReviewProject(): StudioCanvasProjectV1 | null {
  return takePendingStudioProject(SPACE4_ADMIN_REVIEW_PROJECT_KEY);
}

export function dispatchSpace4AdminReviewApply() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SPACE4_ADMIN_REVIEW_APPLY_EVENT));
}

export async function parseSealedSpace4Project(
  sealedContent: string
): Promise<StudioCanvasProjectV1> {
  const raw = await importSecureProject(sealedContent);
  return parseStudioProject(raw);
}
