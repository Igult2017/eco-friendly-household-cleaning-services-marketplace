import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

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
  "/api/webhooks/(.*)",
  "/api/geo/(.*)",
])

// Customer-only routes (no URL prefix — customers are primary users)
const isCustomerOnlyRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/book(.*)",
  "/post-job(.*)",
  "/jobs(.*)",
  "/bookings/(.*)",
  "/payments(.*)",
])

// Provider routes use /provider/* URL prefix
const isProviderRoute = createRouteMatcher(["/provider/(.*)"])

// Admin routes use /admin/* URL prefix
const isAdminRoute = createRouteMatcher(["/admin/(.*)"])

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url)
    signInUrl.searchParams.set("redirect_url", req.url)
    return NextResponse.redirect(signInUrl)
  }

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

  if (isOnboardingRoute(req)) return NextResponse.next()

  // Redirect users who haven't completed onboarding
  if (!role && !isOnboardingRoute(req)) {
    return NextResponse.redirect(new URL("/onboarding", req.url))
  }

  // Protect admin routes
  if (isAdminRoute(req) && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  // Protect provider routes
  if (isProviderRoute(req) && role !== "provider") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  // Protect customer-only routes (admin can also view these for support)
  if (isCustomerOnlyRoute(req) && role !== "customer" && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
