export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getPublishedPosts } from "@/lib/db/queries/blog"
import { BLOG_PAGE_SIZE } from "@/lib/blog/constants"
import { logError } from "@/lib/utils/logError"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category") ?? undefined
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? String(BLOG_PAGE_SIZE), 10) || BLOG_PAGE_SIZE, 1),
      24,
    )

    const rows = await getPublishedPosts({ category, limit: limit + 1, offset })
    return NextResponse.json({ posts: rows.slice(0, limit), hasMore: rows.length > limit })
  } catch (err) {
    console.error("[blog/posts GET]", err)
    void logError({ message: "[blog/posts GET]", error: err, route: "/api/blog/posts", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
