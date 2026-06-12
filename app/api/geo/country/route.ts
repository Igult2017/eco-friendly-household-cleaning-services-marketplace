import { NextResponse } from "next/server"

export const runtime = "edge"

interface IpWhoResponse {
  success: boolean
  country: string
  country_code: string
  city: string
  region: string
  continent_code: string
  latitude: number
  longitude: number
  currency: { code: string }
  timezone: { id: string }
  connection: { isp: string }
}

export async function GET() {
  try {
    const res = await fetch("https://ipwho.is/", {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error("ipwho.is error")
    const data: IpWhoResponse = await res.json()
    if (!data.success) throw new Error("ipwho.is lookup failed")

    return NextResponse.json({
      country: data.country,
      countryCode: data.country_code,
      city: data.city,
      region: data.region,
      continentCode: data.continent_code,
      currency: data.currency?.code ?? "EUR",
      timezone: data.timezone?.id ?? "UTC",
    })
  } catch {
    return NextResponse.json({ country: null, countryCode: null }, { status: 200 })
  }
}
