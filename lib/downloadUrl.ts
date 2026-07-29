import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client, getR2Config, publicObjectUrl, type R2Config } from "@/lib/r2";

/** Prefer public CDN URL; otherwise short-lived signed S3/R2 URL for direct download. */
export async function resolveDownloadUrl(params: {
  key: string;
  expiresInSec?: number;
}): Promise<{ url: string; cached: boolean; mode: "cdn" | "signed" }> {
  const config = getR2Config();
  if (!config) throw new Error("R2 not configured");

  if (config.publicUrl) {
    return {
      url: publicObjectUrl(config, params.key),
      cached: true,
      mode: "cdn",
    };
  }

  const url = await createSignedGetUrl(config, params.key, params.expiresInSec ?? 300);
  return { url, cached: false, mode: "signed" };
}

export async function createSignedGetUrl(
  config: R2Config,
  key: string,
  expiresInSec = 300
) {
  const client = createR2Client(config);
  const command = new GetObjectCommand({ Bucket: config.bucketName, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSec });
}
