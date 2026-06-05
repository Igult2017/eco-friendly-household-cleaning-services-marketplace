import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { errorLogs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, sessionClaims } = await auth()
  if ((sessionClaims?.metadata as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const [updated] = await db
    .update(errorLogs)
    .set({ resolvedAt: new Date(), resolvedBy: userId ?? "admin" })
    .where(eq(errorLogs.id, id))
    .returning({ id: errorLogs.id })

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
