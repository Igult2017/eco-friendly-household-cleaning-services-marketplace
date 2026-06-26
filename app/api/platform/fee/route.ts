import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getCommissionPct } from "@/lib/platform/settings"

// The current platform commission %, used so a logged-in cleaner's payout preview matches the real
// split. Gated to authenticated users — the exact rate is not exposed publicly (the public copy
// describes "a small commission" without a fixed number).
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const pct = await getCommissionPct()
  return NextResponse.json({ pct })
}
