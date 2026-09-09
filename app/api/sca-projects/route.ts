import { NextResponse } from "next/server";
import { getPlanStorageLimits } from "@/lib/planStorageLimits";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { collectUserStorageAliases } from "@/lib/studioStore/userAliases";
import {
  deleteUserScaProject,
  getUserScaProject,
  listUserScaProjects,
  upsertUserScaProject,
} from "@/lib/db/scaProjects";

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
    const aliases = await collectUserStorageAliases(req, resolved.user);
    let project = await getUserScaProject(resolved.user.id, id);
    if (!project) {
      for (const alias of aliases) {
        if (alias === resolved.user.id) continue;
        project = await getUserScaProject(alias, id);
        if (project) break;
      }
    }
    if (!project) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, project });
  }

  const aliases = await collectUserStorageAliases(req, resolved.user);
  const storage = getPlanStorageLimits(
    resolved.user.planId,
    resolved.user.billingInterval ?? "monthly"
  );
  const max = storage.worksGallery;
  const byId = new Map<
    string,
    Awaited<ReturnType<typeof listUserScaProjects>>[number]
  >();
  for (const alias of aliases) {
    const list = await listUserScaProjects(alias, {
      allowEmptyR2Fallback: true,
      relaxOwnerFilter: true,
      max,
    });
    for (const p of list) {
      const prev = byId.get(p.id);
      if (!prev || p.createdAt > prev.createdAt) {
        byId.set(p.id, { ...p, userId: resolved.user.id });
      }
    }
  }
  const projects = [...byId.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max);

  return NextResponse.json({
    ok: true,
    max,
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

  const storage = getPlanStorageLimits(
    resolved.user.planId,
    resolved.user.billingInterval ?? "monthly"
  );
  const project = await upsertUserScaProject(
    resolved.user.id,
    {
      id,
      label: typeof body.label === "string" ? body.label : "수정 프로젝트",
      mode: body.mode === "agent" ? "agent" : "utility",
      sealedContent,
      createdAt: typeof body.createdAt === "number" ? body.createdAt : Date.now(),
      thumbSrc: typeof body.thumbSrc === "string" ? body.thumbSrc : null,
    },
    { max: storage.worksGallery }
  );

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
