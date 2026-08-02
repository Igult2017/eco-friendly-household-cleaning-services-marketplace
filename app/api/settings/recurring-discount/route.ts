import { NextResponse } from "next/server"
import { getRecurringDiscountPct } from "@/lib/platform/settings"

// Public, unauthenticated — the wizard shows this rate as marketing copy BEFORE a client picks
// recurring (per product decision: sell the benefit up front, don't hide it behind a click).
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ pct: await getRecurringDiscountPct() })
}
