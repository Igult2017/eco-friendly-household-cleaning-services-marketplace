import { S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"

// S3-compatible storage client. Defaults to Cloudflare R2's endpoint, but S3_ENDPOINT +
// S3_REGION let it point at any S3-compatible provider (e.g. Backblaze B2:
// S3_ENDPOINT=https://s3.<region>.backblazeb2.com, S3_REGION=<region>). Credentials/bucket/
// public-URL reuse the existing R2_* env vars regardless of provider.
export const r2 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/** Generate a presigned PUT URL for direct client upload */
export async function generatePresignedUploadUrl(params: {
  key: string
  contentType: string
  contentLength: number
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (!ALLOWED_CONTENT_TYPES.includes(params.contentType)) {
    throw new Error(`Content type ${params.contentType} is not allowed`)
  }
  if (params.contentLength > MAX_FILE_SIZE) {
    throw new Error("File size exceeds the 10 MB limit")
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  })

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 })
  const publicUrl = `${PUBLIC_URL}/${params.key}`

  return { uploadUrl, publicUrl }
}

/** Generate a presigned GET URL for a private file */
export async function generatePresignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(r2, command, { expiresIn: 3600 })
}
