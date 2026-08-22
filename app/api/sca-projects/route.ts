import { NextResponse } from "next/server";
import {
  deleteUserScaProject,
  getUserScaProject,
  listUserScaProjects,
  SCA_PROJECTS_MAX,
  upsertUserScaProject,
} from "@/lib/db/scaProjects";
import { resolveAppUser } from "@/lib/resolveAppUser";

export const runtime = "nodejs";

/** GET — list recent `.sca` projects (metadata only) or fetch one by ?id= */
export async function GET(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, projects: [] },
      { status: resolved.status }
    );
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (id) {
    const project = await getUserScaProject(resolved.user.id, id);
    if (!project) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, project });
  }

  const projects = await listUserScaProjects(resolved.user.id);
  return NextResponse.json({
    ok: true,
    max: SCA_PROJECTS_MAX,
    projects: projects.map((p) => ({
      id: p.id,
      label: p.label,
      mode: p.mode,
      createdAt: p.createdAt,
      thumbSrc: p.thumbSrc ?? null,
    })),
  });
}

/** POST — upsert sealed `.sca` content (FIFO max 10). */
export async function POST(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sealedContent = String(body.sealedContent ?? "").trim();
  if (!sealedContent || !sealedContent.includes("SCAENC1")) {
    return NextResponse.json({ error: "sealedContent_required" }, { status: 400 });
  }

  const id =
    String(body.id ?? "").trim() ||
    `sca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const project = await upsertUserScaProject(resolved.user.id, {
    id,
    label: typeof body.label === "string" ? body.label : "수정 프로젝트",
    mode: body.mode === "agent" ? "agent" : "utility",
    sealedContent,
    createdAt: typeof body.createdAt === "number" ? body.createdAt : Date.now(),
    thumbSrc: typeof body.thumbSrc === "string" ? body.thumbSrc : null,
  });

  return NextResponse.json({ ok: true, project: { id: project.id, label: project.label } });
}

/** DELETE — ?id= */
export async function DELETE(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await deleteUserScaProject(resolved.user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id });
}
