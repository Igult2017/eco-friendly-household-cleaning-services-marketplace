export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { generatePresignedDownloadUrl } from "@/lib/r2/client"

// File proxy for a PRIVATE S3/B2 bucket. Stored file URLs point at /api/files/<key>; this signs a
// short-lived GET URL and 302-redirects, so the actual bytes are served by B2 (egress stays off the
// VPS) while the bucket itself stays private (no public access / no card required).
//
// Keys are unguessable, matching the prior public-bucket model. Per-resource auth can be layered on
// later (e.g. only a booking's parties may fetch its photos) by looking up the key's owner here.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params
  const objectKey = (key ?? []).join("/")
  if (!objectKey) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const signed = await generatePresignedDownloadUrl(objectKey)
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: signed,
        // Short cache so an <img> isn't re-signed on every render; well under the 1h URL expiry.
        "Cache-Control": "public, max-age=600",
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
