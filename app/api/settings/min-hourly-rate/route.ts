import { NextResponse } from "next/server"
import { getMinHourlyRateCents } from "@/lib/platform/settings"

// Public, unauthenticated — job-posting and provider-services forms need this live number to
// show/enforce the current floor before the user even submits.
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ cents: await getMinHourlyRateCents() })
}
