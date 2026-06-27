import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { generatePresignedUploadUrl } from "@/lib/r2/client"
import { uploadRatelimit } from "@/lib/redis/client"
import { nanoid } from "nanoid"
import { logError } from "@/lib/utils/logError"

const ALLOWED_FOLDERS = ["completions", "certifications", "avatars", "disputes", "blog-images", "blog-covers"] as const
type AllowedFolder = typeof ALLOWED_FOLDERS[number]

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
      const { success } = await uploadRatelimit.limit(userId)
      if (!success) return NextResponse.json({ error: "Rate limit exceeded. You can upload up to 20 files per hour." }, { status: 429 })
    } catch (redisErr) {
      console.warn("[upload/presigned POST] Redis rate limit unavailable, allowing through:", redisErr)
    }

    const { contentType, contentLength, folder } = await req.json().catch(() => ({}))

    if (!contentType || !contentLength) {
      return NextResponse.json({ error: "contentType and contentLength required" }, { status: 400 })
    }

    // Bug 8: client-supplied contentLength has no cap — reject oversized uploads before issuing a presigned URL
    const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
    if (typeof contentLength !== "number" || contentLength <= 0 || contentLength > MAX_BYTES) {
      return NextResponse.json({ error: `contentLength must be between 1 and ${MAX_BYTES} bytes` }, { status: 400 })
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json({ error: "Content type not allowed" }, { status: 400 })
    }

    const safeFolder: AllowedFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "completions"
    const ext = contentType.split("/")[1] ?? "bin"
    const key = `${safeFolder}/${userId}/${nanoid(12)}.${ext}`

    const { uploadUrl, publicUrl } = await generatePresignedUploadUrl({ key, contentType, contentLength })

    return NextResponse.json({ uploadUrl, publicUrl, key })
  } catch (err) {
    console.error("[upload/presigned POST]", err)
    void logError({ message: "[upload/presigned POST]", error: err, route: "/api/upload/presigned", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
