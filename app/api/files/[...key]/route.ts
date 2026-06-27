export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { generatePresignedDownloadUrl } from "@/lib/r2/client"
import { db } from "@/lib/db"
import { bookings, providers, disputes, blogPosts } from "@/lib/db/schema"
import { and, or, eq, sql } from "drizzle-orm"

// File proxy for a PRIVATE S3/B2 bucket. Stored file URLs point at /api/files/<key>; this signs a
// short-lived GET URL and 302-redirects, so the actual bytes are served by B2 (egress stays off the
// VPS) while the bucket stays private. Keys are `{folder}/{userId}/{nanoid}.{ext}`.
//
// H2: keys are NOT bearer capabilities. Public-asset folders (profile photos, blog images shown on
// logged-out pages) stay open; private folders require authentication AND authorization — the
// uploader, an admin, or a party to the booking/dispute that references the file.
const PUBLIC_FOLDERS = new Set(["avatars", "blog-images", "blog-covers", "hero", "store-images"])

async function isAdmin(userId: string, sessionClaims: unknown): Promise<boolean> {
  let role = (sessionClaims as { metadata?: { role?: string } } | null)?.metadata?.role
  if (!role) {
    try {
      const clerk = await clerkClient()
      const u = await clerk.users.getUser(userId)
      role = (u.publicMetadata as { role?: string })?.role
    } catch {
      return false
    }
  }
  return role === "admin"
}

// A PUBLISHED blog post's cover image is public, even if it was uploaded into a folder we otherwise
// treat as private (legacy covers landed in "completions/" before "blog-covers" was an allowed folder).
async function isPublishedBlogCover(objectKey: string): Promise<boolean> {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "")
  const url = `${base}/${objectKey}`
  const [post] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(and(eq(blogPosts.coverImageUrl, url), eq(blogPosts.status, "published")))
    .limit(1)
  return !!post
}

// Is `userId` a customer/provider party to a booking (completion/before photos) or dispute (evidence)
// that references this exact file URL? Lets the counterparty view photos the other side uploaded.
async function isFileParty(userId: string, objectKey: string): Promise<boolean> {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "")
  const url = `${base}/${objectKey}`
  const arr = JSON.stringify([url])

  const [b] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .where(
      and(
        or(eq(bookings.customerId, userId), eq(providers.userId, userId)),
        or(
          sql`${bookings.completionPhotoUrls} @> ${arr}::jsonb`,
          sql`${bookings.beforePhotoUrls} @> ${arr}::jsonb`,
        ),
      ),
    )
    .limit(1)
  if (b) return true

  const [d] = await db
    .select({ id: disputes.id })
    .from(disputes)
    .innerJoin(bookings, eq(disputes.bookingId, bookings.id))
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .where(
      and(
        or(eq(bookings.customerId, userId), eq(providers.userId, userId)),
        sql`${disputes.evidenceUrls} @> ${arr}::jsonb`,
      ),
    )
    .limit(1)
  return !!d
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params
  const objectKey = (key ?? []).join("/")
  if (!objectKey) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const folder = key?.[0] ?? ""
  let isPublicAsset = PUBLIC_FOLDERS.has(folder)
  // Legacy/edge: a published blog cover is public wherever it was stored.
  if (!isPublicAsset && (await isPublishedBlogCover(objectKey))) isPublicAsset = true

  if (!isPublicAsset) {
    const { userId, sessionClaims } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const ownerId = key?.[1] ?? ""
    const allowed =
      ownerId === userId ||
      (await isAdmin(userId, sessionClaims)) ||
      (await isFileParty(userId, objectKey))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const signed = await generatePresignedDownloadUrl(objectKey)
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: signed,
        "Cache-Control": isPublicAsset ? "public, max-age=600" : "private, max-age=60",
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
