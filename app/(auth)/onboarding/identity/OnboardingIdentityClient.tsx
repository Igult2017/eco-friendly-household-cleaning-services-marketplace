"use client"

import { useRouter } from "next/navigation"
import { IdentityVerifyModal } from "@/components/provider/IdentityVerifyModal"

/**
 * The identity check as a signup step, used only when an admin has set the check to run at
 * onboarding rather than at a cleaner's first job.
 *
 * Renders the SAME component as the one on a cleaner's job page — one camera flow, one set of
 * rules, one place to change them.
 *
 * Skipping is allowed on purpose. The award gate (lib/bookings/identityGate.ts) still stops an
 * unverified cleaner at their first job, so skipping delays the check rather than avoiding it.
 * Forcing it here would strand anyone whose camera fails at signup.
 */
export function OnboardingIdentityClient() {
  const router = useRouter()
  const goToDashboard = () => router.push("/provider/dashboard")

  return (
    <div className="py-4">
      <IdentityVerifyModal onVerified={goToDashboard} />
      <button
        onClick={goToDashboard}
        className="mt-4 w-full rounded-lg px-4 py-2 text-sm text-[#6B7280] transition-colors duration-200 hover:text-[#2B3441]"
      >
        I&apos;ll do this later
      </button>
      <p className="mt-3 text-center text-xs text-[#6B7280]">
        You can come back to this any time, but you&apos;ll need to finish it before your first job.
      </p>
    </div>
  )
}
