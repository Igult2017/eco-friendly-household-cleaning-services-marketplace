import { NextResponse } from "next/server"
import { getCancellationConfig } from "@/lib/platform/settings"

// Public, unauthenticated — the client's cancel page needs these live numbers to show an accurate
// "you'll get X% back" preview that actually matches what /api/bookings/[id]/cancel applies (it was
// previously hardcoded to its own guessed 24/48h breakpoints, independent of the real config).
export const dynamic = "force-dynamic"

export async function GET() {
  const cfg = await getCancellationConfig()
  return NextResponse.json(cfg)
}
