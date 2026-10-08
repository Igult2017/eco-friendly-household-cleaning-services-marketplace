import { NextResponse } from "next/server"
import { getMinBookingMinutes } from "@/lib/platform/settings"

// Public, unauthenticated — the booking wizard and the job-posting form need this live number to
// show and enforce the current minimum before the user submits, rather than after a rejection.
// Mirrors app/api/settings/min-hourly-rate.
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ minutes: await getMinBookingMinutes() })
}
