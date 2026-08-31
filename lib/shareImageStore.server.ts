import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
} from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import {
  sanitizeShareId,
  sharePublicMetaKey,
  type ShareImageMeta,
} from "@/lib/shareImageStore";

export async function loadShareMetaById(
  rawId: string
): Promise<ShareImageMeta | null> {
  const id = sanitizeShareId(rawId);
  if (!id || !isR2Configured()) return null;
  const config = getR2Config()!;
  const client = createR2Client(config);
  const buf = await getR2Object(client, config.bucketName, sharePublicMetaKey(id));
  if (!buf) return null;
  try {
    const parsed = JSON.parse(buf.toString("utf8")) as ShareImageMeta;
    if (!parsed?.id || !parsed?.imageKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function resolveShareImageUrl(
  meta: ShareImageMeta,
  expiresInSec = 60 * 60 * 24 * 7
): Promise<string> {
  const resolved = await resolveDownloadUrl({
    key: meta.imageKey,
    expiresInSec,
  });
  return resolved.url;
}
