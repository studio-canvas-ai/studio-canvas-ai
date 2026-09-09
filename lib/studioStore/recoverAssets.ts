import {
  listUserScaProjects,
  upsertUserScaProject,
} from "@/lib/db/scaProjects";
import {
  listUserFaceProfiles,
  replaceUserFaceProfiles,
} from "@/lib/db/faceProfiles";
import { listUserGeneralPhotos } from "@/lib/db/generalPhotos";
import { getDb } from "@/lib/db/store";
import type { FaceProfileRecord, ScaProjectRecord } from "@/lib/db/types";
import {
  createR2Client,
  getR2Config,
  isR2Configured,
  listR2Keys,
} from "@/lib/r2";
import { mergeRecentEntries, mergeVaultItems, vaultsFromLookbooks } from "@/lib/studioStore/merge";
import {
  loadStudioStoresFromR2,
  loadStudioStoresFromSupabase,
  saveStudioStoreBundle,
} from "@/lib/studioStore/serverStore";
import type {
  RecentDrawerEntry,
  StudioStoreBundle,
  StudioStoreRecoverDiagnostics,
  StudioStoreRecoverResult,
} from "@/lib/studioStore/types";
import type { FaceProfile } from "@/lib/faceProfiles";

function toFaceProfile(row: FaceProfileRecord): FaceProfile {
  return {
    id: row.id,
    name: row.name,
    slot: row.slot,
    photoUrls: row.photoUrls,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function loadScaFromAliases(
  canonicalUserId: string,
  aliases: string[]
): Promise<{ projects: ScaProjectRecord[]; emptyR2Skipped: number }> {
  let emptyR2Skipped = 0;
  const collected: ScaProjectRecord[] = [];
  const seen = new Set<string>();

  for (const alias of aliases) {
    const list = await listUserScaProjects(alias, {
      allowEmptyR2Fallback: true,
      relaxOwnerFilter: true,
    });
    if (list.length === 0) emptyR2Skipped += 1;
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      collected.push({ ...p, userId: canonicalUserId });
    }
  }

  const mem = getDb().scaProjects;
  for (const alias of aliases) {
    for (const p of mem[alias] ?? []) {
      if (seen.has(p.id)) continue;
      if (!p.sealedContent?.includes("SCAENC1")) continue;
      seen.add(p.id);
      collected.push({ ...p, userId: canonicalUserId });
    }
  }

  collected.sort((a, b) => b.createdAt - a.createdAt);
  const sliced = collected.slice(0, 10);
  for (const p of sliced) {
    try {
      await upsertUserScaProject(canonicalUserId, p);
    } catch {
      /* keep going */
    }
  }
  return { projects: sliced, emptyR2Skipped };
}

async function loadFacesFromAliases(
  canonicalUserId: string,
  aliases: string[]
): Promise<FaceProfile[]> {
  const collected: FaceProfileRecord[] = [];
  const seen = new Set<string>();
  for (const alias of aliases) {
    const list = await listUserFaceProfiles(alias, {
      allowEmptyR2Fallback: true,
      relaxOwnerFilter: true,
    });
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      collected.push({ ...p, userId: canonicalUserId });
    }
  }
  const mem = getDb().faceProfiles;
  for (const alias of aliases) {
    for (const p of mem[alias] ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      collected.push({ ...p, userId: canonicalUserId });
    }
  }
  if (collected.length) {
    try {
      await replaceUserFaceProfiles(
        canonicalUserId,
        collected.map((p) => ({
          id: p.id,
          name: p.name,
          slot: p.slot,
          photoUrls: p.photoUrls,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }))
      );
    } catch (err) {
      console.warn("[studioStore] face profile rekey failed", err);
    }
  }
  return collected.map(toFaceProfile);
}

async function scanR2AliasManifests(aliases: string[]): Promise<string[]> {
  if (!isR2Configured()) return [];
  const config = getR2Config();
  if (!config) return [];
  const client = createR2Client(config);
  const aliasSet = new Set(aliases);
  const found: string[] = [];
  for (const prefix of ["sca/", "faces/", "general/", "studio-store/"]) {
    try {
      const keys = await listR2Keys(client, config.bucketName, prefix);
      for (const key of keys) {
        if (!key.endsWith("manifest.json") && !key.endsWith(".json")) continue;
        const folder = key.split("/")[1];
        if (folder && aliasSet.has(folder)) found.push(key);
      }
    } catch {
      /* ignore prefix */
    }
  }
  return found;
}

export async function recoverStudioAssetsForUser(opts: {
  canonicalUserId: string;
  supabaseUserId?: string | null;
  aliases: string[];
  incoming?: Partial<StudioStoreBundle>;
}): Promise<StudioStoreRecoverResult> {
  const aliases = [...new Set([opts.canonicalUserId, ...opts.aliases])].filter(
    Boolean
  );

  const [supabasePack, r2Pack, scaPack, faces, manifests, incomingGeneral] =
    await Promise.all([
      loadStudioStoresFromSupabase(aliases),
      loadStudioStoresFromR2(aliases),
      loadScaFromAliases(opts.canonicalUserId, aliases),
      loadFacesFromAliases(opts.canonicalUserId, aliases),
      scanR2AliasManifests(aliases),
      listUserGeneralPhotos(opts.canonicalUserId).catch(() => []),
    ]);

  void incomingGeneral;

  const recentFromSca: RecentDrawerEntry[] = [];
  // Sealed .sca stays on the gallery API; client unseals into the drawer.
  // We still merge any JSON already in studio_user_stores / R2.

  const recentShared = mergeRecentEntries(
    opts.incoming?.recentShared ?? [],
    supabasePack.bundle.recentShared ?? [],
    r2Pack.bundle.recentShared ?? [],
    recentFromSca
  );
  const recentPhoto = mergeRecentEntries(
    opts.incoming?.recentPhoto ?? [],
    supabasePack.bundle.recentPhoto ?? [],
    r2Pack.bundle.recentPhoto ?? []
  );

  const fromBooksShared = vaultsFromLookbooks(recentShared);
  const fromBooksPhoto = vaultsFromLookbooks(recentPhoto);

  const uploadVault = mergeVaultItems(
    opts.incoming?.uploadVault ?? [],
    supabasePack.bundle.uploadVault ?? [],
    r2Pack.bundle.uploadVault ?? [],
    fromBooksShared.upload,
    fromBooksPhoto.upload
  );
  const trainedVault = mergeVaultItems(
    opts.incoming?.trainedVault ?? [],
    supabasePack.bundle.trainedVault ?? [],
    r2Pack.bundle.trainedVault ?? [],
    fromBooksShared.trained,
    fromBooksPhoto.trained
  );

  const bundle: StudioStoreBundle = {
    recentShared,
    recentPhoto,
    uploadVault,
    trainedVault,
    activeTrainedId:
      opts.incoming?.activeTrainedId ??
      trainedVault[0]?.id ??
      null,
  };

  const durable = await saveStudioStoreBundle({
    canonicalUserId: opts.canonicalUserId,
    supabaseUserId: opts.supabaseUserId,
    bundle,
  });

  const diagnostics: StudioStoreRecoverDiagnostics = {
    aliasesTried: aliases,
    manifestsFound: [...new Set([...r2Pack.keys, ...manifests])],
    supabaseRows: supabasePack.rowCount,
    scaProjectsRecovered: scaPack.projects.length,
    faceProfilesRecovered: faces.length,
    vaultsFromLookbooks:
      fromBooksShared.upload.length +
      fromBooksShared.trained.length +
      fromBooksPhoto.upload.length +
      fromBooksPhoto.trained.length,
    emptyR2Skipped: scaPack.emptyR2Skipped,
  };

  return {
    ok: true,
    ...durable,
    faceProfiles: faces,
    diagnostics,
  };
}
