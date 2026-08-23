import { NextResponse } from "next/server"

// Every browser automatically requests this exact address on its own, regardless of what the
// page's own <link rel="icon"> tag says (which correctly points at app/icon.svg already). With
// nothing here to answer it directly, that request fell through into the locale-routing machinery
// (which needs a cookie to decide which language to show) and Next.js flagged that as a real
// error — confirmed live, this address was returning a genuine HTTP 500. A plain route handler
// like this runs before any of that page/locale machinery, so it just redirects straight to the
// real, working icon instead.
export function GET(req: Request) {
  // req.url's own origin is NOT reliable here — verified live: behind this app's reverse proxy it
  // resolved to the container's internal bind address (0.0.0.0:3000), not the public domain the
  // browser actually used, producing a redirect nobody outside the server could follow. Read the
  // real public host straight from the request headers instead (the same pattern already used in
  // lib/utils/ip.ts for the client's real IP behind the same proxy) — this is what the browser
  // itself sent, so it's correct on any of the app's domains without needing to know them upfront.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? "https"
  const target = host ? `${proto}://${host}/icon.svg` : new URL("/icon.svg", req.url)
  return NextResponse.redirect(target, 308)
}
