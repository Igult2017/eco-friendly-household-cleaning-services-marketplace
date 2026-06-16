import { NextResponse } from "next/server"
import { getCommissionPct } from "@/lib/platform/settings"

// Exposes the current platform commission % so the booking preview matches the
// real charge. Non-sensitive (it's shown to customers at checkout anyway).
export async function GET() {
  const pct = await getCommissionPct()
  return NextResponse.json({ pct })
}
