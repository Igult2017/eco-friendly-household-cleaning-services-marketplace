import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { db } from "@/lib/db"
import { errorLogs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin
    const userId = admin.adminId

    const { id } = await params

    const [updated] = await db
      .update(errorLogs)
      .set({ resolvedAt: new Date(), resolvedBy: userId ?? "admin" })
      .where(eq(errorLogs.id, id))
      .returning({ id: errorLogs.id })

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[admin/errors/[id]/resolve POST]", err)
    void logError({ message: "[admin/errors/[id]/resolve POST]", error: err, route: "/api/admin/errors/[id]/resolve", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
