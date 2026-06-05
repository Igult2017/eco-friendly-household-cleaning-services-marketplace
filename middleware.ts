import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/browse(.*)",
  "/provider/(.*)",
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

const isCustomerRoute = createRouteMatcher(["/customer(.*)"])
const isProviderRoute = createRouteMatcher(["/provider/dashboard(.*)", "/provider/jobs(.*)", "/provider/bookings(.*)", "/provider/schedule(.*)", "/provider/earnings(.*)", "/provider/profile(.*)", "/provider/reviews(.*)", "/provider/settings(.*)"])
const isAdminRoute = createRouteMatcher(["/admin(.*)"])
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"])

export default clerkMiddleware(async (auth, req) => {
  // Allow all public routes without auth
  if (isPublicRoute(req)) return NextResponse.next()

  const { userId, sessionClaims } = await auth()

  // Redirect unauthenticated users to sign-in
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url)
    signInUrl.searchParams.set("redirect_url", req.url)
    return NextResponse.redirect(signInUrl)
  }

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

  // Allow onboarding for any authenticated user
  if (isOnboardingRoute(req)) return NextResponse.next()

  // Role-based route guards
  if (isAdminRoute(req) && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (isProviderRoute(req) && role !== "provider") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (isCustomerRoute(req) && role !== "customer" && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  // Redirect users who haven't completed onboarding
  if (!role && !isOnboardingRoute(req)) {
    return NextResponse.redirect(new URL("/onboarding", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
