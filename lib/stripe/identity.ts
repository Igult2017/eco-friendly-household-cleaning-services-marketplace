import { stripe } from "./client"

// The identity check a cleaner must pass once, before they can keep a job they have been awarded.
//
// ONE place defines what "verified" means here, because the rules are the product: if a second call
// site built its own session with weaker options, a cleaner could be waved through on a softer check
// and nobody would notice.

/**
 * How many paid attempts a cleaner gets before the job is re-awarded instead.
 *
 * Stripe bills per COMPLETED verification, and "completed" includes a FAILED one — so each retry
 * costs real money. Two attempts covers the honest failures (a blurry photo, bad light, a document
 * held at the wrong angle) without funding an indefinite series of tries.
 */
export const MAX_IDENTITY_ATTEMPTS = 2

/** The documents a cleaner may use. Covers what people actually carry in the EU and the US. */
export const ALLOWED_DOCUMENTS = ["passport", "id_card", "driving_license"] as const

/**
 * Start an identity check for one cleaner and return the secret the in-app pop-up needs.
 *
 * Returns a `client_secret`, NOT a hosted URL: the pop-up opens over the cleaner's own job page via
 * stripe.verifyIdentity(), so they never leave DORIXÉ. (The previous version returned session.url,
 * which sent them to Stripe's website and lost them mid-flow.)
 */
export async function createIdentityCheck(params: {
  /**
   * The cleaner this check belongs to. Omitted ONLY for an admin's test run — see adminTestFor.
   */
  providerId?: string
  bookingId?: string
  /**
   * An admin trying the check out from the settings panel, before any real cleaner meets it.
   *
   * When this is set, `provider_id` is deliberately LEFT OUT of the metadata, and that omission is
   * what makes a test harmless: the webhook only acts on a result when `provider_id` is present
   * (app/api/webhooks/stripe/route.ts), so a test can never mark a real cleaner verified — or
   * failed — no matter what the admin photographs. Safe by construction rather than by remembering.
   */
  adminTestFor?: string
  /**
   * Stripe's own guidance is to key creation on an internal user reference so a repeated request
   * cannot leave the same person with two sessions. Pass one per cleaner per attempt.
   */
  idempotencyKey?: string
}) {
  const session = await stripe.identity.verificationSessions.create(
    {
      type: "document",
      options: {
        document: {
          allowed_types: [...ALLOWED_DOCUMENTS],
          // Capture the face and compare it to the photo on the document. Without this the check only
          // proves the document exists, not that the person holding it is its owner.
          require_matching_selfie: true,
          // Disables file uploads: the document must be photographed with the device camera. Without
          // it a cleaner can upload a picture of a picture — a screenshot of someone else's ID passes
          // a document check but should never pass a person check.
          require_live_capture: true,
        },
      },
      // Carried back on the webhook, which is how a result finds the cleaner and the waiting job.
      // An admin test carries NO provider_id, so the webhook ignores its result entirely.
      metadata: params.adminTestFor
        ? { admin_test: "1", admin_id: params.adminTestFor }
        : {
            provider_id: params.providerId!,
            ...(params.bookingId ? { booking_id: params.bookingId } : {}),
          },
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
  )
  return { id: session.id, clientSecret: session.client_secret }
}

/**
 * What Stripe currently holds for a session — used to PROVE the rules above actually took, rather
 * than trusting that a 200 meant the options were accepted verbatim.
 */
export async function readIdentityCheck(sessionId: string) {
  const s = await stripe.identity.verificationSessions.retrieve(sessionId)
  const doc = s.options?.document
  return {
    status: s.status,
    requiresLiveCapture: doc?.require_live_capture === true,
    requiresMatchingSelfie: doc?.require_matching_selfie === true,
    allowedTypes: doc?.allowed_types ?? [],
    lastErrorCode: s.last_error?.code ?? null,
  }
}

/**
 * True when Stripe is refusing because Identity is not switched on for the account at all.
 *
 * Stripe Identity is a SEPARATE product that an account admin has to enable; until then every
 * attempt to start a check fails with "Your account is not set up to use Identity". That is not a
 * bug in this code and not the cleaner's fault, but both were previously reported as a generic
 * "could not start" — which is indistinguishable from a real fault and sent us hunting.
 *
 * Matched on the message because Stripe returns this as a plain invalid_request_error with no
 * distinguishing code of its own. Deliberately broad: a false positive just produces a clearer
 * message, while a false negative hides the one thing the reader needs to know.
 */
export function isIdentityNotEnabled(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "")
  return /not set up to use Identity|identity\/application/i.test(msg)
}

/** What to tell an account admin, including where to go. */
export const IDENTITY_NOT_ENABLED_ADMIN_MESSAGE =
  "Stripe Identity is not switched on for this account yet, so no identity check can start. " +
  "An account admin needs to enable it at https://dashboard.stripe.com/identity/application — " +
  "it takes a couple of minutes, and nothing else here needs changing."

/**
 * Turn Stripe's failure code into something a cleaner can act on.
 *
 * Stripe's codes are precise but not addressed to the person who has to fix it — "selfie_face_mismatch"
 * tells a cleaner nothing about what to do next. English only, like the other admin-facing strings;
 * the cleaner-facing copy that wraps this is translated separately.
 */
export function explainIdentityFailure(code: string | null | undefined): string {
  switch (code) {
    case "document_expired":
      return "The document has expired. Use one that is still in date."
    case "document_type_not_supported":
    case "document_type_not_allowed":
      return "That document type cannot be used. Use a passport, national ID card or driving licence."
    case "selfie_face_mismatch":
      return "The face photo did not match the photo on the document."
    case "selfie_manipulated":
      return "The face photo appeared to have been altered."
    case "selfie_document_missing_photo":
      return "The document has no photo on it, so the face check could not be done."
    case "under_supported_age":
      return "The date of birth on the document is below the minimum age."
    case "country_not_supported":
      return "Identity checks are not available for that document's country yet."
    case "device_not_supported":
      return "That device could not open the camera. Try again on a phone."
    case "consent_declined":
      return "The check was declined before it started."
    case "abandoned":
      return "The check was closed before it finished."
    default:
      return "The identity check could not be completed."
  }
}
