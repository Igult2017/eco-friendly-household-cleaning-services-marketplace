import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server"
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/providers/(.*)",
  "/services(.*)",
  "/how-it-works(.*)",
  "/sustainability(.*)",
  "/pricing(.*)",
  "/blog(.*)",
  "/legal(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/browse-jobs(.*)",
  "/affiliate(.*)",
  "/about(.*)",
  "/become-a-cleaner(.*)",
  "/api/webhooks/(.*)",
  "/unsubscribe(.*)", // email unsubscribe confirmation — clicked from emails while logged out
  "/api/email/(.*)", // one-click unsubscribe endpoint (RFC 8058) — must be public
  "/api/geo/(.*)",
  "/api/jobs/public(.*)",
  "/api/blog/(.*)",
  "/_a/(.*)", // Umami analytics proxy (script + event collection) — must be public
  // SEO infra — crawlers must reach these without auth
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/llms.txt",
])

const isCustomerOnlyRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/book(.*)",
  "/post-job(.*)",
  "/jobs(.*)",
  "/bookings/(.*)",
  "/payments(.*)",
  "/notifications(.*)",
  "/profile(.*)",
  "/recurring(.*)",
])

const isProviderRoute = createRouteMatcher(["/provider/(.*)"])
const isAdminRoute = createRouteMatcher(["/admin/(.*)"])
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)", "/api/onboarding/(.*)"])

const VALID_ROLES = ["customer", "provider", "admin"]

function setCookieOnResponse(res: NextResponse, userId: string, role: string): NextResponse {
  res.cookies.set("dorix_role", `${userId}:${role}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
  return res
}

// Behind Traefik, req.url's host is the internal bind address (0.0.0.0:3000).
// Rebuild the public origin from the proxy's forwarded headers so redirects and
// the Clerk redirect_url point at the real domain, not the container.
function publicBase(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? "https"
  return host ? `${proto}://${host}` : req.nextUrl.origin
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()

  const base = publicBase(req)
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    const signInUrl = new URL("/sign-in", base)
    signInUrl.searchParams.set("redirect_url", `${base}${req.nextUrl.pathname}${req.nextUrl.search}`)
    return NextResponse.redirect(signInUrl)
  }

  let role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  let shouldRefreshCookie = false

  // JWT hasn't refreshed yet (60s TTL) — read role from the cookie set during onboarding.
  if (!role) {
    const roleCookie = req.cookies.get("dorix_role")?.value
    if (roleCookie) {
      const [cookieUserId, cookieRole] = roleCookie.split(":")
      if (cookieUserId === userId && VALID_ROLES.includes(cookieRole)) {
        role = cookieRole
      }
    }
  }

  // Cookie expired or missing — hit Clerk API as last resort.
  if (!role) {
    try {
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(userId)
      const clerkRole = (clerkUser.publicMetadata as { role?: string })?.role
      if (clerkRole && VALID_ROLES.includes(clerkRole)) {
        role = clerkRole
        shouldRefreshCookie = true
      }
    } catch {
      // Clerk API unreachable — fall through to onboarding redirect
    }
  }

  if (isOnboardingRoute(req)) {
    const res = NextResponse.next()
    if (shouldRefreshCookie && role) setCookieOnResponse(res, userId, role)
    return res
  }

  if (!role) return NextResponse.redirect(new URL("/onboarding", base))

  // Admin-only gate: non-admins cannot access /admin/* routes
  if (isAdminRoute(req) && role !== "admin") return NextResponse.redirect(new URL("/", base))

  // Admin bypasses all further role-based route restrictions (can view provider/customer UIs)
  if (role === "admin") {
    const res = NextResponse.next()
    if (shouldRefreshCookie) setCookieOnResponse(res, userId, role)
    return res
  }

  // Dual-role: use the active-role cookie to determine which section this user is browsing
  const isDual = (sessionClaims?.metadata as { dualRole?: boolean } | undefined)?.dualRole === true
  let effectiveRole = role
  if (isDual) {
    const activeRoleCookie = req.cookies.get("dorix_active_role")?.value
    if (activeRoleCookie === "customer" || activeRoleCookie === "provider") {
      effectiveRole = activeRoleCookie
    }
  }

  if (isProviderRoute(req) && effectiveRole !== "provider") return NextResponse.redirect(new URL("/", base))
  if (isCustomerOnlyRoute(req) && effectiveRole !== "customer") return NextResponse.redirect(new URL("/", base))

  const res = NextResponse.next()
  if (shouldRefreshCookie) setCookieOnResponse(res, userId, role)
  return res
})

// BUG-002: when Clerk errors, fail OPEN only for public routes; fail CLOSED for
// protected ones so an outage / key mismatch can't expose /admin, /provider, /book, etc.
function clerkErrorFallback(req: NextRequest): NextResponse {
  if (isPublicRoute(req)) return NextResponse.next()
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication temporarily unavailable" }, { status: 503 })
  }
  const base = publicBase(req)
  const signInUrl = new URL("/sign-in", base)
  signInUrl.searchParams.set("redirect_url", `${base}${req.nextUrl.pathname}${req.nextUrl.search}`)
  return NextResponse.redirect(signInUrl)
}

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  // Capture ?ref=CODE and store in a 30-day cookie so the referral survives sign-up
  const refCode = req.nextUrl.searchParams.get("ref")
  if (refCode && /^[A-Z0-9]{6,20}$/i.test(refCode) && !req.cookies.get("dorix_ref")) {
    let base: NextResponse
    if (!process.env.CLERK_SECRET_KEY) {
      base = NextResponse.next()
    } else {
      try {
        const handled = await clerkHandler(req, event)
        base = (handled instanceof NextResponse ? handled : null) ?? NextResponse.next()
      } catch (err) {
        console.error("[middleware] Clerk error (ref path):", err)
        base = clerkErrorFallback(req)
      }
    }
    base.cookies.set("dorix_ref", refCode.toUpperCase(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    })
    return base
  }

  // If Clerk is not configured, pass every request through so the app still renders
  if (!process.env.CLERK_SECRET_KEY) return NextResponse.next()

  try {
    return (await clerkHandler(req, event)) ?? NextResponse.next()
  } catch (err) {
    // BUG-002: fail closed for protected routes (public routes still pass through).
    console.error("[middleware] Clerk error:", err)
    return clerkErrorFallback(req)
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
}
