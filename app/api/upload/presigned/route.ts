import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { generatePresignedUploadUrl } from "@/lib/r2/client"
import { uploadRatelimit } from "@/lib/redis/client"
import { nanoid } from "nanoid"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await uploadRatelimit.limit(userId)
  if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

  const { contentType, contentLength, folder = "uploads" } = await req.json()

  if (!contentType || !contentLength) {
    return NextResponse.json({ error: "contentType and contentLength required" }, { status: 400 })
  }

  const ext = contentType.split("/")[1] ?? "bin"
  const key = `${folder}/${userId}/${nanoid(12)}.${ext}`

  const { uploadUrl, publicUrl } = await generatePresignedUploadUrl({ key, contentType, contentLength })

  return NextResponse.json({ uploadUrl, publicUrl, key })
}
