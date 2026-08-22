import { getDb, withDbLock } from "@/lib/db/store";
import type { ScaProjectRecord } from "@/lib/db/types";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
  putR2Object,
} from "@/lib/r2";

export const SCA_PROJECTS_MAX = 10;

type UserManifest = {
  userId: string;
  updatedAt: number;
  projects: ScaProjectRecord[];
};

function manifestKey(userId: string) {
  return `sca/${userId}/manifest.json`;
}

async function saveR2Manifest(userId: string, projects: ScaProjectRecord[]) {
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  const body: UserManifest = {
    userId,
    updatedAt: Date.now(),
    projects,
  };
  await putR2Object(
    client,
    config.bucketName,
    manifestKey(userId),
    Buffer.from(JSON.stringify(body)),
    "application/json"
  );
}

async function loadR2Manifest(userId: string): Promise<ScaProjectRecord[] | null> {
  const config = getR2Config();
  if (!config) return null;
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, manifestKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as UserManifest;
    if (!Array.isArray(parsed.projects)) return [];
    return parsed.projects.filter(
      (p) =>
        typeof p?.id === "string" &&
        typeof p?.sealedContent === "string" &&
        p.userId === userId &&
        p.sealedContent.includes("SCAENC1")
    );
  } catch {
    return null;
  }
}

function sortProjects(projects: ScaProjectRecord[]) {
  return [...projects].sort((a, b) => b.createdAt - a.createdAt);
}

export async function listUserScaProjects(userId: string): Promise<ScaProjectRecord[]> {
  if (isR2Configured()) {
    const fromR2 = await loadR2Manifest(userId);
    if (fromR2 !== null) {
      await withDbLock((db) => {
        db.scaProjects[userId] = fromR2;
      });
      return sortProjects(fromR2).slice(0, SCA_PROJECTS_MAX);
    }
  }
  const mem = getDb().scaProjects[userId] ?? [];
  return sortProjects(mem).slice(0, SCA_PROJECTS_MAX);
}

export async function upsertUserScaProject(
  userId: string,
  item: Omit<ScaProjectRecord, "userId"> & { userId?: string }
): Promise<ScaProjectRecord> {
  const existing = await listUserScaProjects(userId);
  const sealed = item.sealedContent.trim();
  if (!sealed.includes("SCAENC1")) {
    throw new Error("invalid_sca_content");
  }

  const record: ScaProjectRecord = {
    id: item.id,
    userId,
    label: item.label.trim() || "수정 프로젝트",
    mode: item.mode === "agent" ? "agent" : "utility",
    sealedContent: sealed,
    createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
    thumbSrc: item.thumbSrc ?? null,
  };

  const projects = [record, ...existing.filter((p) => p.id !== record.id)].slice(
    0,
    SCA_PROJECTS_MAX
  );

  await withDbLock((db) => {
    db.scaProjects[userId] = projects;
  });
  await saveR2Manifest(userId, projects);
  return record;
}

export async function getUserScaProject(
  userId: string,
  projectId: string
): Promise<ScaProjectRecord | null> {
  const list = await listUserScaProjects(userId);
  return list.find((p) => p.id === projectId) ?? null;
}

export async function deleteUserScaProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const existing = await listUserScaProjects(userId);
  if (!existing.some((p) => p.id === projectId)) return false;
  const projects = existing.filter((p) => p.id !== projectId);
  await withDbLock((db) => {
    db.scaProjects[userId] = projects;
  });
  await saveR2Manifest(userId, projects);
  return true;
}
