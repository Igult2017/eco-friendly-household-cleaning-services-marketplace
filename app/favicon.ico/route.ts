import { NextResponse } from "next/server"

// Every browser automatically requests this exact address on its own, regardless of what the
// page's own <link rel="icon"> tag says (which correctly points at app/icon.svg already). With
// nothing here to answer it directly, that request fell through into the locale-routing machinery
// (which needs a cookie to decide which language to show) and Next.js flagged that as a real
// error — confirmed live, this address was returning a genuine HTTP 500. A plain route handler
// like this runs before any of that page/locale machinery, so it just redirects straight to the
// real, working icon instead.
export function GET(req: Request) {
  // Redirect relative to whichever address the browser is actually on (the app answers on more
  // than one domain) rather than a single hardcoded/env-configured one.
  return NextResponse.redirect(new URL("/icon.svg", req.url), 308)
}
