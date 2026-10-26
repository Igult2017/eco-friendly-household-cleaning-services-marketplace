import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import {
  createIdentityCheck, readIdentityCheck, explainIdentityFailure,
  isIdentityNotEnabled, IDENTITY_NOT_ENABLED_ADMIN_MESSAGE,
} from "@/lib/stripe/identity"
import { logError } from "@/lib/utils/logError"

/**
 * Lets an admin run the cleaner identity check on themselves, from the settings panel.
 *
 * WHY: the check had never run once — nobody had ever passed or failed one — so the first person to
 * find out whether it actually works would have been a real cleaner with a real job at stake. This
 * is deliberately the SAME check, not a copy: it calls `createIdentityCheck`, the one place that
 * defines what verification requires (camera only, face matched to the document, passport / ID card
 * / driving licence). A copy could drift, and then a passing test would prove nothing.
 *
 * SAFETY: created with NO provider_id in its metadata. The webhook only acts on a result that
 * carries one (app/api/webhooks/stripe/route.ts), so an admin's test can never verify — or fail —
 * a real cleaner, whatever document goes in front of the camera.
 *
 * COST: Stripe bills per SUBMITTED check, pass or fail, about $1.50 (first 50 free). Opening the
 * window and closing it again costs nothing.
 */
export async function POST() {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const check = await createIdentityCheck({ adminTestFor: guard.adminId })

    return NextResponse.json({ clientSecret: check.clientSecret, sessionId: check.id })
  } catch (err) {
    // Say WHY when Stripe gives a reason the reader can act on. The generic "could not start"
    // this used to return was indistinguishable from a real fault, and cost real time hunting a
    // bug that did not exist — the product simply was not switched on.
    if (isIdentityNotEnabled(err)) {
      void logError({
        message: "[admin/identity-test] Stripe Identity is not enabled on this account",
        error: err, route: "/api/admin/identity-test", severity: "warning",
      })
      return NextResponse.json({ error: IDENTITY_NOT_ENABLED_ADMIN_MESSAGE, setupRequired: true }, { status: 409 })
    }

    console.error("[admin/identity-test POST]", err)
    void logError({
      message: "[admin/identity-test POST]",
      error: err,
      route: "/api/admin/identity-test",
      severity: "error",
    })
    return NextResponse.json({ error: "Could not start the test check." }, { status: 500 })
  }
}

/**
 * Reads back what Stripe made of the admin's test, so the panel can say plainly whether it worked.
 * Also reports the rules the check was created with — the proof that a cleaner gets the same thing.
 */
export async function GET(req: Request) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const sessionId = new URL(req.url).searchParams.get("sessionId")
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })

    const result = await readIdentityCheck(sessionId)

    return NextResponse.json({
      status: result.status,
      verified: result.status === "verified",
      // Stripe is still deciding — the panel should wait rather than call it a failure.
      processing: result.status === "processing",
      reason: result.lastErrorCode ? explainIdentityFailure(result.lastErrorCode) : null,
      // What the check actually demanded, read back from Stripe rather than assumed.
      rules: {
        cameraOnly: result.requiresLiveCapture,
        faceMatch: result.requiresMatchingSelfie,
        documents: result.allowedTypes,
      },
    })
  } catch (err) {
    console.error("[admin/identity-test GET]", err)
    void logError({
      message: "[admin/identity-test GET]",
      error: err,
      route: "/api/admin/identity-test",
      severity: "error",
    })
    return NextResponse.json({ error: "Could not read the test result." }, { status: 500 })
  }
}
