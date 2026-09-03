import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

async function requireAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null
  // Admin is a Clerk publicMetadata role — NOT the DB role (which is the onboarding role).
  let role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (!role) {
    try {
      const clerk = await clerkClient()
      const u = await clerk.users.getUser(userId)
      role = (u.publicMetadata as { role?: string })?.role
    } catch {
      return null
    }
  }
  return role === "admin" ? userId : null
}

/**
 * Every change to a post's published state goes through here — publish now, schedule for later,
 * cancel a schedule, or unpublish. Keeping all four in one place is deliberate: scattering state
 * changes across the create and update routes is how a post ends up in a state nothing expects.
 *
 * Body (all optional):
 *   {}                        → toggle: draft/scheduled → published, published → draft
 *   { scheduledFor: ISO }     → hold as "scheduled" until that moment
 *   { cancelSchedule: true }  → scheduled → draft
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const [post] = await db.select({ status: blogPosts.status }).from(blogPosts).where(eq(blogPosts.id, id))
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const { scheduledFor, cancelSchedule } = body as { scheduledFor?: unknown; cancelSchedule?: unknown }

    if (cancelSchedule === true) {
      await db.update(blogPosts)
        .set({ status: "draft", scheduledFor: null, publishedAt: null, updatedAt: new Date() })
        .where(eq(blogPosts.id, id))
      return NextResponse.json({ status: "draft" })
    }

    if (typeof scheduledFor === "string" && scheduledFor.trim()) {
      const when = new Date(scheduledFor)
      if (Number.isNaN(when.getTime())) {
        return NextResponse.json({ error: "That publish date isn't valid." }, { status: 400 })
      }
      // A time already past means "publish now" rather than an error — that is what someone picking
      // a moment a few seconds ago plainly intends, and the sweep would publish it within minutes
      // anyway. Refusing would only be a confusing way of doing the same thing.
      if (when.getTime() <= Date.now()) {
        await db.update(blogPosts)
          .set({ status: "published", publishedAt: new Date(), scheduledFor: null, updatedAt: new Date() })
          .where(eq(blogPosts.id, id))
        return NextResponse.json({ status: "published", published: true })
      }
      await db.update(blogPosts)
        .set({ status: "scheduled", scheduledFor: when, publishedAt: null, updatedAt: new Date() })
        .where(eq(blogPosts.id, id))
      return NextResponse.json({ status: "scheduled", scheduledFor: when.toISOString() })
    }

    // Plain toggle. A scheduled post counts as "not yet published", so this publishes it now and
    // clears the pending date — otherwise the sweep would find it again later.
    const nowPublished = post.status !== "published"
    await db.update(blogPosts).set({
      status: nowPublished ? "published" : "draft",
      publishedAt: nowPublished ? new Date() : null,
      scheduledFor: null,
      updatedAt: new Date(),
    }).where(eq(blogPosts.id, id))

    return NextResponse.json({ published: nowPublished, status: nowPublished ? "published" : "draft" })
  } catch (err) {
    console.error("[admin/blog/[id]/publish PATCH]", err)
    void logError({ message: "[admin/blog/[id]/publish PATCH]", error: err, route: "/api/admin/blog/[id]/publish", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
