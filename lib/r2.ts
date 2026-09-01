import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint?: string;
  publicUrl?: string;
};

function envFirst(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim().replace(/^["']|["']$/g, "");
    if (!value) continue;
    // `vercel env pull` redacts sensitive values as `[SENSITIVE]`.
    if (value === "[SENSITIVE]" || value === "SENSITIVE") continue;
    return value;
  }
  return undefined;
}

export function getR2Config(): R2Config | null {
  const accountId = envFirst("R2_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = envFirst("R2_ACCESS_KEY_ID", "CLOUDFLARE_ACCESS_KEY_ID");
  const secretAccessKey = envFirst(
    "R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_SECRET_ACCESS_KEY"
  );
  const bucketName = envFirst("R2_BUCKET_NAME", "CLOUDFLARE_BUCKET_NAME");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) return null;
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint: envFirst("R2_ENDPOINT", "CLOUDFLARE_R2_ENDPOINT"),
    publicUrl: envFirst("R2_PUBLIC_URL", "CLOUDFLARE_R2_PUBLIC_URL"),
  };
}

export function isR2Configured(): boolean {
  return getR2Config() != null;
}

/** Resolved bucket name from env (e.g. studio-canvas-ai-storage). */
export function getR2BucketName(): string | null {
  return getR2Config()?.bucketName ?? null;
}

/** AWS SDK v3 adds CRC32 to presigned URLs; R2 rejects them (browser PUT fails at 0%). */
const R2_PRESIGN_UNSIGNABLE_HEADERS = new Set([
  "x-amz-checksum-crc32",
  "x-amz-checksum-crc32c",
  "x-amz-checksum-sha1",
  "x-amz-checksum-sha256",
  "x-amz-sdk-checksum-algorithm",
]);

function presignUrlOptions(expiresInSec: number) {
  return {
    expiresIn: expiresInSec,
    unsignableHeaders: R2_PRESIGN_UNSIGNABLE_HEADERS,
  };
}

/**
 * Account-level R2 S3 endpoint — must NOT embed the bucket name in the host.
 * Path-style requests put the bucket in the URL path (`/{bucket}/{key}`).
 */
export function normalizeR2Endpoint(config: R2Config): string {
  const accountId = config.accountId.trim();
  const canonical = `https://${accountId}.r2.cloudflarestorage.com`;
  const raw = config.endpoint?.trim().replace(/\/$/, "");
  if (!raw) return canonical;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const accountHost = `${accountId.toLowerCase()}.r2.cloudflarestorage.com`;

    // Virtual-hosted style ({bucket}.{account}.r2...) → force account-level host.
    if (
      host.endsWith(".r2.cloudflarestorage.com") &&
      host !== accountHost &&
      host.endsWith(`.${accountHost}`)
    ) {
      return canonical;
    }

    if (host === accountHost) {
      return canonical;
    }

    // Non-R2 custom endpoint — keep as configured (minus trailing path segments).
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return canonical;
  }
}

export function createR2Client(config: R2Config): S3Client {
  // R2 is S3-compatible but rejects AWS SDK v3 default CRC32 checksums
  // and virtual-hosted bucket URLs. Path-style + checksums only when required.
  return new S3Client({
    region: "auto",
    endpoint: normalizeR2Endpoint(config),
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export function publicObjectUrl(config: R2Config, key: string): string {
  if (config.publicUrl) {
    return `${config.publicUrl.replace(/\/$/, "")}/${key}`;
  }
  return `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Browser → R2 direct upload (bypasses Vercel request body limits).
 * Content-Type is intentionally omitted from SigV4. Mobile Chrome must not send
 * Content-Type on PUT (triggers CORS preflight failures at 0% progress).
 */
export async function createSignedPutUrl(
  config: R2Config,
  key: string,
  _contentType: string,
  expiresInSec = 900
): Promise<string> {
  const client = createR2Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });
  return getSignedUrl(client, command, presignUrlOptions(expiresInSec));
}

export async function createMultipartUpload(
  config: R2Config,
  key: string
): Promise<string> {
  const client = createR2Client(config);
  const res = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );
  const uploadId = res.UploadId?.trim();
  if (!uploadId) throw new Error("multipart_upload_id_missing");
  return uploadId;
}

export async function createSignedPartUploadUrl(
  config: R2Config,
  key: string,
  uploadId: string,
  partNumber: number,
  expiresInSec = 900
): Promise<string> {
  const client = createR2Client(config);
  const command = new UploadPartCommand({
    Bucket: config.bucketName,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(client, command, presignUrlOptions(expiresInSec));
}

export async function completeMultipartUpload(
  config: R2Config,
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
): Promise<void> {
  const client = createR2Client(config);
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .map((p) => ({
            PartNumber: p.partNumber,
            ETag: p.etag,
          }))
          .sort((a, b) => a.PartNumber - b.PartNumber),
      },
    })
  );
}

export async function uploadR2Part(
  config: R2Config,
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer | Uint8Array
): Promise<string> {
  const client = createR2Client(config);
  const res = await client.send(
    new UploadPartCommand({
      Bucket: config.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    })
  );
  const etag = res.ETag?.trim();
  if (!etag) throw new Error("r2_part_etag_missing");
  return etag;
}

export async function headR2Object(
  client: S3Client,
  bucket: string,
  key: string
): Promise<{ contentLength?: number; contentType?: string } | null> {
  try {
    const res = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
    return {
      contentLength: res.ContentLength,
      contentType: res.ContentType,
    };
  } catch {
    return null;
  }
}

export async function putR2Object(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
) {
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`r2_put_failed:${key}:${message}`);
  }
}

export async function getR2Object(
  client: S3Client,
  bucket: string,
  key: string
): Promise<Buffer | null> {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch {
    return null;
  }
}

export async function deleteR2Object(client: S3Client, bucket: string, key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function listR2Keys(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}
