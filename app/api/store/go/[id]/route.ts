import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { storeProducts } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

// Affiliate outbound-click redirect. The store cards link here instead of straight to the brand so we
// can count interest (clicks++) before 302-ing to the external affiliate URL. Public + GET only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Build the public origin from the proxy's forwarded headers (req.url is the internal bind address).
  const ecoStoreUrl = () => {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
    const proto = req.headers.get("x-forwarded-proto") ?? "https"
    const base = host ? `${proto}://${host}` : new URL(req.url).origin
    return `${base}/eco-store`
  }

  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.redirect(ecoStoreUrl())

    const [product] = await db
      .select({ affiliateUrl: storeProducts.affiliateUrl, status: storeProducts.status })
      .from(storeProducts)
      .where(eq(storeProducts.id, id))

    // Only redirect for a real, published listing — never leak a draft's destination.
    if (!product || product.status !== "published") return NextResponse.redirect(ecoStoreUrl())

    // Defence in depth: only ever 302 to an http(s) destination — never a javascript:/data: URL from a
    // legacy/unvalidated row — so this public endpoint can't be abused beyond an affiliate redirect.
    try {
      const proto = new URL(product.affiliateUrl).protocol
      if (proto !== "http:" && proto !== "https:") return NextResponse.redirect(ecoStoreUrl())
    } catch {
      return NextResponse.redirect(ecoStoreUrl())
    }

    // Count the click; never let a failed counter block the redirect.
    try {
      await db.update(storeProducts).set({ clicks: sql`${storeProducts.clicks} + 1` }).where(eq(storeProducts.id, id))
    } catch { /* non-fatal */ }

    return NextResponse.redirect(product.affiliateUrl)
  } catch (err) {
    console.error("[store/go GET]", err)
    void logError({ message: "[store/go GET]", error: err, route: "/api/store/go/[id]", severity: "error" })
    return NextResponse.redirect(ecoStoreUrl())
  }
}
