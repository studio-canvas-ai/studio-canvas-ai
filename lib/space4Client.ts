/**
 * Client helper — deposit sealed .sca into Space 4 / Template 04 (fire-and-forget safe).
 */

import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import { exportSecureProject } from "@/lib/projectStorage";
import {
  blobToSpace4ThumbDataUrl,
  normalizeSpace4ThumbSrc,
} from "@/lib/space4Thumb";
import {
  dispatchSpace4AdminReviewApply,
  parseSealedSpace4Project,
  stashSpace4AdminReview,
  stashSpace4ReviewProject,
} from "@/lib/space4AdminReview";

export type Space4VaultMeta = {
  id: string;
  userId: string;
  label: string;
  mode: "utility" | "agent";
  createdAt: number;
  source?: string;
  thumbSrc?: string | null;
};

export async function depositProjectToSpace4(opts: {
  project: StudioCanvasProjectV1;
  label?: string;
  source?: string;
  /** Raster export from the active canvas page (preferred thumbnail source). */
  thumbBlob?: Blob | null;
}): Promise<{ id: string } | null> {
  try {
    const sealed = await exportSecureProject(opts.project);
    const wizard = opts.project.lookbook?.wizard;

    let thumbSrc: string | null = null;
    if (opts.thumbBlob && opts.thumbBlob.size > 0) {
      thumbSrc = await blobToSpace4ThumbDataUrl(opts.thumbBlob);
    }

    if (!thumbSrc) {
      const thumbCandidates = [
        opts.project.studio.backgroundUrl,
        opts.project.studio.subjectUrl,
        wizard?.backgroundUrl,
        ...(wizard?.backgroundUrls ?? []),
      ].filter((u): u is string => typeof u === "string" && u.trim().length > 0);

      for (const thumb of thumbCandidates) {
        const normalized = normalizeSpace4ThumbSrc(thumb);
        if (normalized) {
          thumbSrc = normalized;
          break;
        }
      }
    }

    thumbSrc = normalizeSpace4ThumbSrc(thumbSrc);

    const res = await fetch("/api/space4/deposit", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label:
          opts.label?.trim() ||
          (opts.project.studio.mode === "agent"
            ? "통합 에디터 프로젝트"
            : "템플릿 프로젝트"),
        mode: opts.project.studio.mode,
        sealedContent: sealed,
        createdAt: opts.project.savedAt || Date.now(),
        source: opts.source ?? "print-unified-editor",
        thumbSrc,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(
        "[space4Client] deposit HTTP failed",
        res.status,
        errBody.slice(0, 300)
      );
      return null;
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) {
      console.warn("[space4Client] deposit ok but missing id");
      return null;
    }
    return { id: data.id };
  } catch (err) {
    console.warn("[space4Client] deposit failed", err);
    return null;
  }
}

export async function fetchSpace4VaultMeta(
  limit = 500
): Promise<Space4VaultMeta[]> {
  try {
    const res = await fetch(`/api/admin/space4?limit=${limit}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(
        "[space4Client] list vault failed",
        res.status,
        await res.text().catch(() => "")
      );
      return [];
    }
    const data = (await res.json()) as { items?: Space4VaultMeta[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.warn("[space4Client] list vault error", err);
    return [];
  }
}

export async function fetchSpace4SealedRecord(
  id: string
): Promise<
  | {
      ok: true;
      label: string;
      thumbSrc: string | null;
      sealedContent: string;
    }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`/api/admin/space4/${encodeURIComponent(id)}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error || "fetch_failed" };
    }
    const data = (await res.json()) as {
      label?: string;
      thumbSrc?: string | null;
      sealedContent?: string;
    };
    if (!data.sealedContent) {
      return { ok: false, error: "no_content" };
    }
    return {
      ok: true,
      label: data.label?.trim() || "검수 작업물",
      thumbSrc: normalizeSpace4ThumbSrc(data.thumbSrc),
      sealedContent: data.sealedContent,
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Load a Space 4 item into Screen 26 for manual admin review. */
export async function openSpace4InEditorForReview(
  item: Space4VaultMeta
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fetched = await fetchSpace4SealedRecord(item.id);
  if (!fetched.ok) return fetched;

  try {
    const project = await parseSealedSpace4Project(fetched.sealedContent);
    stashSpace4ReviewProject(project);
    stashSpace4AdminReview({
      space4Id: item.id,
      label: fetched.label || item.label,
      startedAt: Date.now(),
    });
    dispatchSpace4AdminReviewApply();
    return { ok: true };
  } catch {
    return { ok: false, error: "parse_failed" };
  }
}

export async function publishSpace4ReviewToTemplate03(opts: {
  space4Id: string;
  project: StudioCanvasProjectV1;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/admin/space4/promote", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: opts.space4Id,
        project: opts.project,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error || "promote_failed" };
    }
    const data = (await res.json()) as { id?: string };
    return data.id ? { ok: true, id: data.id } : { ok: false, error: "no_id" };
  } catch {
    return { ok: false, error: "network" };
  }
}
