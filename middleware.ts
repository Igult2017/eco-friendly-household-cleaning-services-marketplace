import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
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
])

const isCustomerOnlyRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/book(.*)",
  "/post-job(.*)",
  "/jobs(.*)",
  "/bookings/(.*)",
  "/payments(.*)",
])

const isProviderRoute = createRouteMatcher(["/provider/(.*)"])
const isAdminRoute = createRouteMatcher(["/admin/(.*)"])
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"])

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url)
    signInUrl.searchParams.set("redirect_url", req.url)
    return NextResponse.redirect(signInUrl)
  }

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

  if (isOnboardingRoute(req)) return NextResponse.next()

  if (!role) return NextResponse.redirect(new URL("/onboarding", req.url))

  if (isAdminRoute(req) && role !== "admin") return NextResponse.redirect(new URL("/", req.url))
  if (isProviderRoute(req) && role !== "provider") return NextResponse.redirect(new URL("/", req.url))
  if (isCustomerOnlyRoute(req) && role !== "customer" && role !== "admin") return NextResponse.redirect(new URL("/", req.url))

  return NextResponse.next()
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
