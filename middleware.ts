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
  "/api/webhooks/(.*)",
  "/api/geo/(.*)",
  "/api/jobs/public(.*)",
  "/api/blog/(.*)",
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

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url)
    signInUrl.searchParams.set("redirect_url", req.url)
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

  if (!role) return NextResponse.redirect(new URL("/onboarding", req.url))

  if (isAdminRoute(req) && role !== "admin") return NextResponse.redirect(new URL("/", req.url))
  if (isProviderRoute(req) && role !== "provider") return NextResponse.redirect(new URL("/", req.url))
  if (isCustomerOnlyRoute(req) && role !== "customer" && role !== "admin") return NextResponse.redirect(new URL("/", req.url))

  const res = NextResponse.next()
  if (shouldRefreshCookie) setCookieOnResponse(res, userId, role)
  return res
})

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  // If Clerk is not configured, pass every request through so the app still renders
  if (!process.env.CLERK_SECRET_KEY) return NextResponse.next()

  try {
    return (await clerkHandler(req, event)) ?? NextResponse.next()
  } catch (err) {
    // Clerk misconfiguration or key mismatch — log and fail open so the UI is reachable
    console.error("[middleware] Clerk error, passing request through:", err)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
