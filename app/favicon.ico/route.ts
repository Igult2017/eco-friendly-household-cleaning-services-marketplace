import { NextResponse } from "next/server"

// Every browser automatically requests this exact address on its own, regardless of what the
// page's own <link rel="icon"> tag says (which correctly points at app/icon.svg already). With
// nothing here to answer it directly, that request fell through into the locale-routing machinery
// (which needs a cookie to decide which language to show) and Next.js flagged that as a real
// error — confirmed live, this address was returning a genuine HTTP 500. A plain route handler
// like this runs before any of that page/locale machinery, so it just redirects straight to the
// real, working icon instead.
// TEMPORARY DIAGNOSTIC — two attempts to build the redirect target both still resolved to
// 0.0.0.0:3000 live (req.url's origin, then x-forwarded-host/host headers). Rather than guess a
// third time, dump exactly what this handler actually receives in production so the real fix can
// be based on real data. Remove once the actual cause is confirmed.
export function GET(req: Request) {
  return NextResponse.json({
    reqUrl: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  })
}
