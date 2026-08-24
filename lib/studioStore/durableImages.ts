import { normalizeGeneralPhotoWebp } from "@/lib/imagePipeline";
import {
  createR2Client,
  getR2Config,
  isR2Configured,
  publicObjectUrl,
  putR2Object,
} from "@/lib/r2";

function dataUrlToBuffer(imageUrl: string): Buffer | null {
  if (!imageUrl.startsWith("data:")) return null;
  const comma = imageUrl.indexOf(",");
  if (comma < 0) return null;
  try {
    const buffer = Buffer.from(imageUrl.slice(comma + 1), "base64");
    return buffer.length >= 32 ? buffer : null;
  } catch {
    return null;
  }
}

/**
 * Persist a vault/recent image as an R2 HTTPS URL so device switches do not
 * depend on localStorage data-URLs (quota / wipe).
 */
export async function persistImageToDurableUrl(
  userId: string,
  folder: string,
  id: string,
  imageUrl: string
): Promise<string> {
  if (!imageUrl) return imageUrl;
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
    return imageUrl;
  }
  if (!isR2Configured()) return imageUrl;

  const bufferIn = dataUrlToBuffer(imageUrl);
  if (!bufferIn) return imageUrl;

  let buffer = bufferIn;
  try {
    buffer = await normalizeGeneralPhotoWebp(bufferIn);
  } catch {
    /* keep original bytes */
  }

  const config = getR2Config()!;
  const client = createR2Client(config);
  const key = `studio-store/${userId}/${folder}/${id}.webp`;
  await putR2Object(client, config.bucketName, key, buffer, "image/webp");
  return publicObjectUrl(config, key);
}
