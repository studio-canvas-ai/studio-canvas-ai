import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { collectUserStorageAliases } from "@/lib/studioStore/userAliases";
import { recoverStudioAssetsForUser } from "@/lib/studioStore/recoverAssets";
import {
  loadMergedCloudBundle,
  saveStudioStoreBundle,
} from "@/lib/studioStore/serverStore";
import {
  preservedCloudKinds,
  studioBundleCounts,
  studioBundleIsEmpty,
} from "@/lib/studioStore/persistKeys";
import type { StudioStoreBundle } from "@/lib/studioStore/types";
import { getToken } from "next-auth/jwt";
import {
  authSessionCookieName,
  useSecureAuthCookies,
} from "@/lib/authCookies";
import { requireAuthSecret } from "@/lib/authSecret";

export const runtime = "nodejs";
export const maxDuration = 60;

async function supabaseUserIdFrom(req: Request): Promise<string | null> {
  try {
    const token = await getToken({
      req,
      secret: requireAuthSecret(),
      secureCookie: useSecureAuthCookies(),
      cookieName: authSessionCookieName(),
    });
    return typeof token?.supabaseUserId === "string"
      ? token.supabaseUserId
      : typeof token?.providerAccountId === "string" &&
          /^[0-9a-f-]{36}$/i.test(token.providerAccountId)
        ? token.providerAccountId
        : null;
  } catch {
    return null;
  }
}

function parseBundle(body: Record<string, unknown>): StudioStoreBundle {
  const asArr = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    recentShared: asArr(body.recentShared) as StudioStoreBundle["recentShared"],
    recentPhoto: asArr(body.recentPhoto) as StudioStoreBundle["recentPhoto"],
    uploadVault: asArr(body.uploadVault) as StudioStoreBundle["uploadVault"],
    trainedVault: asArr(body.trainedVault) as StudioStoreBundle["trainedVault"],
    activeTrainedId:
      typeof body.activeTrainedId === "string" ? body.activeTrainedId : null,
  };
}

/** GET — recover + return durable recent files / vaults for the signed-in user. */
export async function GET(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, ok: false },
      {
        status: resolved.status,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }

  const aliases = await collectUserStorageAliases(req, resolved.user);
  const supabaseUserId = await supabaseUserIdFrom(req);
  const recovered = await recoverStudioAssetsForUser({
    canonicalUserId: resolved.user.id,
    supabaseUserId,
    aliases,
  });

  return NextResponse.json(recovered, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** POST — persist local dual-cache snapshot to Supabase + R2. */
export async function POST(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, ok: false },
      { status: resolved.status }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const incoming = parseBundle(body);
  const aliases = await collectUserStorageAliases(req, resolved.user);
  const supabaseUserId = await supabaseUserIdFrom(req);

  const cloud = await loadMergedCloudBundle(
    [...new Set([resolved.user.id, supabaseUserId, ...aliases].filter(Boolean))] as string[]
  );
  if (studioBundleIsEmpty(incoming) && !studioBundleIsEmpty(cloud.bundle)) {
    return NextResponse.json(
      {
        ok: false,
        error: "empty_payload_rejected",
        preserved: preservedCloudKinds(incoming, cloud.bundle),
        counts: studioBundleCounts(cloud.bundle),
      },
      { status: 409 }
    );
  }

  const recovered = await recoverStudioAssetsForUser({
    canonicalUserId: resolved.user.id,
    supabaseUserId,
    aliases,
    incoming,
  });

  return NextResponse.json(recovered);
}

/** PUT — same merge + anti-wipe as POST (client cache must never clobber cloud). */
export async function PUT(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, ok: false },
      { status: resolved.status }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const incoming = parseBundle(body);
  const supabaseUserId = await supabaseUserIdFrom(req);
  const aliases = await collectUserStorageAliases(req, resolved.user);
  const cloud = await loadMergedCloudBundle(
    [...new Set([resolved.user.id, supabaseUserId, ...aliases].filter(Boolean))] as string[]
  );
  if (studioBundleIsEmpty(incoming) && !studioBundleIsEmpty(cloud.bundle)) {
    return NextResponse.json(
      {
        ok: false,
        error: "empty_payload_rejected",
        preserved: preservedCloudKinds(incoming, cloud.bundle),
        counts: studioBundleCounts(cloud.bundle),
      },
      { status: 409 }
    );
  }

  const durable = await saveStudioStoreBundle({
    canonicalUserId: resolved.user.id,
    supabaseUserId,
    bundle: incoming,
    mode: "merge",
  });
  return NextResponse.json({
    ok: true,
    counts: studioBundleCounts(durable),
    preserved: preservedCloudKinds(incoming, cloud.bundle),
  });
}
