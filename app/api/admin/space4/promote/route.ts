import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { parseStudioProject } from "@/lib/canvas/projectFile";
import { importSecureProject } from "@/lib/projectStorage";
import {
  getSpace4Record,
  removeSpace4Record,
} from "@/lib/space4Vault";
import { upsertTemplate03Public } from "@/lib/template03Public";
import { cloneTemplatePages } from "@/lib/templateWarehouse";
import type { PrintFormatId, PrintPageCount } from "@/lib/printWizardTypes";
import type { TextLayer } from "@/lib/thumbnailStyles";

export const runtime = "nodejs";

function isPrintFormatId(v: unknown): v is PrintFormatId {
  return typeof v === "string" && v.length > 0;
}

function isPageCount(v: unknown): v is PrintPageCount {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10;
}

function resolveBackgroundUrl(
  project: ReturnType<typeof parseStudioProject>,
  vaultThumb: string | null | undefined
): string | null {
  const wizard = project.lookbook?.wizard;
  const bg =
    project.studio.backgroundUrl ||
    wizard?.backgroundUrl ||
    wizard?.backgroundUrls?.find((u) => typeof u === "string" && u.trim()) ||
    vaultThumb ||
    null;
  return typeof bg === "string" && bg.startsWith("http") ? bg : null;
}

function resolveThumbSrc(
  project: ReturnType<typeof parseStudioProject>,
  vaultThumb: string | null | undefined
): string | null {
  const bg = resolveBackgroundUrl(project, vaultThumb);
  if (typeof vaultThumb === "string" && vaultThumb.startsWith("http")) {
    return vaultThumb.slice(0, 500);
  }
  return bg ? bg.slice(0, 500) : null;
}

/**
 * POST — admin publishes a Template 04 vault item into Template 03 public.
 * When `project` is supplied (manual Screen 26 review), layers are stored as-is
 * with no automatic PII masking. Removes the source vault entry (move semantics).
 */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const space4Id = String(body.id ?? body.space4Id ?? "").trim();
  if (!space4Id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  try {
    const vault = await getSpace4Record(space4Id);
    if (!vault) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    let project: ReturnType<typeof parseStudioProject>;
    if (body.project && typeof body.project === "object") {
      project = parseStudioProject(body.project);
    } else {
      const raw = await importSecureProject(vault.sealedContent);
      project = parseStudioProject(raw);
    }

    const wizard = project.lookbook?.wizard;
    const pages: TextLayer[][] =
      wizard?.textLayersByPage?.length
        ? (wizard.textLayersByPage as TextLayer[][])
        : [project.studio.overlayLayers ?? []];

    const formatId: PrintFormatId = isPrintFormatId(wizard?.formatId)
      ? wizard!.formatId
      : "a4";
    const pageCount: PrintPageCount = isPageCount(wizard?.pageCount)
      ? wizard!.pageCount
      : 1;

    const backgroundUrl = resolveBackgroundUrl(project, vault.thumbSrc);
    const thumbSrc = resolveThumbSrc(project, vault.thumbSrc);
    const manualReview = Boolean(body.project);

    const publicId = `tpl03_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const record = await upsertTemplate03Public({
      id: publicId,
      title: vault.label?.trim() || "공개 템플릿",
      subtitle: manualReview
        ? "관리자 검수 · 수동 편집"
        : "관리자 승인",
      formatId,
      pageCount,
      thumbClass: "bg-slate-800",
      textLayersByPage: cloneTemplatePages(pages, false),
      backgroundUrl,
      thumbSrc,
      maskedNote: manualReview ? "관리자 검수 완료" : undefined,
      promotedFromSpace4Id: space4Id,
      createdAt: Date.now(),
    });

    await removeSpace4Record(space4Id);

    return NextResponse.json({
      ok: true,
      id: record.id,
      title: record.title,
    });
  } catch (err) {
    console.error("[api/admin/space4/promote] POST", err);
    return NextResponse.json({ error: "promote_failed" }, { status: 500 });
  }
}
