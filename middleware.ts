import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server"
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server"
import createIntlMiddleware from "next-intl/middleware"
import { routing } from "@/i18n/routing"
import { locales } from "@/i18n/config"

const intlMiddleware = createIntlMiddleware(routing)

// PUBLIC marketing pages now live under /[locale]; next-intl handles their locale routing
// (/, /de, /fr…) and serves the prerendered static variants. Authenticated routes are NOT
// localized, so they never reach intlMiddleware.
const isLocalizedRoute = createRouteMatcher([
  "/",
  "/about(.*)", "/affiliate(.*)", "/become-a-cleaner(.*)", "/blog(.*)", "/browse(.*)",
  "/browse-jobs(.*)", "/eco-store(.*)", "/how-it-works(.*)", "/legal(.*)", "/pricing(.*)", "/providers(.*)",
  "/services(.*)", "/sustainability(.*)", "/unsubscribe(.*)",
])

// Any path whose first segment is a supported locale (/de/about, /fr…) is a localized public page.
function firstSegmentIsLocale(pathname: string): boolean {
  const seg = pathname.split("/")[1]
  return (locales as readonly string[]).includes(seg)
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/providers/(.*)",
  "/services(.*)",
  "/how-it-works(.*)",
  "/sustainability(.*)",
  "/pricing(.*)",
  "/blog(.*)",
  "/eco-store(.*)",
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
  "/api/files/(.*)", // private-bucket file proxy → signs + redirects; must be reachable without auth
  "/api/jobs/public(.*)",
  "/api/blog/(.*)",
  "/api/store/go/(.*)", // affiliate outbound-click redirect — public (clicked while logged out)
  "/_a/(.*)", // Umami analytics proxy (script + event collection) — must be public
  "/monitoring(.*)", // Sentry tunnel — client error events POST here; must be reachable without auth
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
const isAffiliateRoute = createRouteMatcher(["/partner(.*)"])
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)", "/api/onboarding/(.*)"])

const VALID_ROLES = ["customer", "provider", "admin", "affiliate"]

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
  // Localized public marketing pages → next-intl (locale routing + static serving).
  if (isLocalizedRoute(req) || firstSegmentIsLocale(req.nextUrl.pathname)) {
    return intlMiddleware(req)
  }
  // Other public routes (sign-in, webhooks, robots, analytics proxy…) pass straight through.
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

  // Admin-only gate. A stale dorix_role cookie (or a session token that doesn't carry metadata)
  // can hold an old role even after the role was changed in Clerk, so re-verify against Clerk
  // before denying an /admin route — otherwise a real admin gets locked out.
  if (isAdminRoute(req) && role !== "admin") {
    try {
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(userId)
      if ((clerkUser.publicMetadata as { role?: string })?.role === "admin") {
        role = "admin"
        shouldRefreshCookie = true
      }
    } catch {
      // Clerk API unreachable — fall through to the redirect below
    }
  }
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

  if (isAffiliateRoute(req) && effectiveRole !== "affiliate") return NextResponse.redirect(new URL("/", base))
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
  if (refCode && /^[A-Za-z0-9-]{3,24}$/.test(refCode) && !req.cookies.get("dorix_ref")) {
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
    base.cookies.set("dorix_ref", refCode, {
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
    // Always run middleware for API routes — even file-extension paths like /api/files/x.jpg — so
    // the Clerk auth() context is available in the handler (the proxy authorizes private files).
    "/api/(.*)",
  ],
}
