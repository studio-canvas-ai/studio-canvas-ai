import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { parseStudioProject } from "@/lib/canvas/projectFile";
import { importSecureProject } from "@/lib/projectStorage";
import {
  getSpace4Record,
  removeSpace4Record,
} from "@/lib/space4Vault";
import { upsertTemplate03Public } from "@/lib/template03Public";
import {
  cloneTemplatePages,
  maskTemplatePii,
} from "@/lib/templateWarehouse";
import type { PrintFormatId, PrintPageCount } from "@/lib/printWizardTypes";
import type { TextLayer } from "@/lib/thumbnailStyles";

export const runtime = "nodejs";

function isPrintFormatId(v: unknown): v is PrintFormatId {
  return typeof v === "string" && v.length > 0;
}

function isPageCount(v: unknown): v is PrintPageCount {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10;
}

/**
 * POST — admin promotes a Template 04 (Space 4) vault item into Template 03 public.
 * Masks PII in text layers, then removes the source vault entry (move semantics).
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

    const raw = await importSecureProject(vault.sealedContent);
    const project = parseStudioProject(raw);
    const wizard = project.lookbook?.wizard;

    const pages: TextLayer[][] =
      wizard?.textLayersByPage?.length
        ? (wizard.textLayersByPage as TextLayer[][])
        : [project.studio.overlayLayers ?? []];

    const maskedPages = cloneTemplatePages(pages, true);

    const formatId: PrintFormatId = isPrintFormatId(wizard?.formatId)
      ? wizard!.formatId
      : "a4";
    const pageCount: PrintPageCount = isPageCount(wizard?.pageCount)
      ? wizard!.pageCount
      : 1;

    const bg =
      project.studio.backgroundUrl ||
      wizard?.backgroundUrl ||
      wizard?.backgroundUrls?.find((u) => typeof u === "string" && u.trim()) ||
      vault.thumbSrc ||
      null;

    const publicId = `tpl03_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const record = await upsertTemplate03Public({
      id: publicId,
      title: maskTemplatePii(vault.label || "공개 템플릿"),
      subtitle: "관리자 승인 · 개인정보 마스킹",
      formatId,
      pageCount,
      thumbClass: "bg-slate-800",
      textLayersByPage: maskedPages,
      backgroundUrl:
        typeof bg === "string" && bg.startsWith("http") ? bg : null,
      thumbSrc:
        typeof vault.thumbSrc === "string" && vault.thumbSrc.startsWith("http")
          ? vault.thumbSrc
          : typeof bg === "string" && bg.startsWith("http")
            ? bg.slice(0, 500)
            : null,
      maskedNote: "연락처·이메일 마스킹 적용",
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
