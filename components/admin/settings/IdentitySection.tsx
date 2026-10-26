"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react"
import { Config, SetFn } from "./shared"
import { IdentityVerifyModal } from "@/components/provider/IdentityVerifyModal"

type TestResult = {
  verified: boolean
  processing: boolean
  status: string
  reason: string | null
  rules: { cameraOnly: boolean; faceMatch: boolean; documents: string[] }
}

/**
 * Identity check: whether cleaners are asked at all, when they are asked, and a way for the admin
 * to try the exact check themselves before any cleaner ever meets it.
 *
 * The test deliberately renders the SAME IdentityVerifyModal a cleaner uses, pointed at an
 * admin-only route. A separate admin flow could drift from the real one, and then a passing test
 * would prove nothing about what cleaners actually get.
 */
export function IdentitySection({ cfg, set }: { cfg: Config; set: SetFn }) {
  const enabled = cfg.identity_enabled ?? "on"
  const [result, setResult] = useState<TestResult | null>(null)
  const [checking, setChecking] = useState(false)

  async function readResult(sessionId?: string) {
    if (!sessionId) return
    setChecking(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/identity-test?sessionId=${encodeURIComponent(sessionId)}`)
      if (res.ok) setResult(await res.json())
    } catch { /* the panel just shows nothing rather than a false verdict */ } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">Identity Checks for Cleaners</label>
        <p className="text-xs text-[#6B7280] mb-3">
          Cleaners photograph an ID with their camera and take a photo of their face, which is matched
          against the document. Switching this <strong>off</strong> stops anyone being asked —
          <strong> and immediately releases any cleaner currently waiting on one</strong>, so nobody is
          left stuck holding a job they cannot start.
        </p>
        <select
          value={enabled}
          onChange={e => set("identity_enabled", e.target.value)}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
        >
          <option value="on">On — cleaners must verify their identity</option>
          <option value="off">Off — nobody is asked to verify</option>
        </select>
      </div>

      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">When Cleaners Verify</label>
        <p className="text-xs text-[#6B7280] mb-3">
          Each cleaner only ever does this <strong>once</strong>, whichever option you pick. Verifying
          at their first job means you only pay for cleaners who actually get work. Verifying at
          signup means every cleaner on the platform is already checked — but you pay for cleaners who
          may never take a job. Either way, a cleaner who skipped it is still stopped at their first
          job.
        </p>
        <select
          value={cfg.identity_mode ?? "first_job"}
          onChange={e => set("identity_mode", e.target.value)}
          disabled={enabled === "off"}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F] disabled:opacity-50"
        >
          <option value="first_job">At their first job — booking, winning a bid, or taking an urgent task</option>
          <option value="onboarding">Right after signing up — before they can do anything else</option>
        </select>
      </div>

      <div className="px-6 py-5">
        <label className="block text-sm font-semibold text-[#2B3441] mb-1">Try It Yourself</label>
        <p className="text-xs text-[#6B7280] mb-3">
          Runs the <strong>exact check a cleaner gets</strong> — same camera, same face match, same
          accepted documents — so you can confirm it works before the first cleaner ever reaches it.
          Your result is <strong>never</strong> recorded against any cleaner&apos;s account.
          <br />
          <span className="text-[#9CA3AF]">
            Stripe charges about $1.50 for each check you actually submit, pass or fail. Your first 50
            are free and none have been used. Opening this and closing it again costs nothing.
          </span>
        </p>

        <IdentityVerifyModal
          endpoint="/api/admin/identity-test"
          hideJobWarning
          onVerified={readResult}
        />

        {checking && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[#6B7280]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Asking Stripe what it decided…
          </p>
        )}

        {result && (
          <div
            className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
              result.verified
                ? "border-green-200 bg-green-50 text-green-800"
                : result.processing
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <p className="flex items-center gap-2 font-semibold">
              {result.verified ? <CheckCircle2 className="h-4 w-4" />
                : result.processing ? <Clock className="h-4 w-4" />
                : <XCircle className="h-4 w-4" />}
              {result.verified ? "It works — Stripe verified the identity."
                : result.processing ? "Stripe is still checking. Press the button again in a moment."
                : "Stripe did not verify this one."}
            </p>
            {result.reason && <p className="mt-1 text-xs">{result.reason}</p>}
            <p className="mt-2 text-xs opacity-80">
              Rules this check used — the same ones cleaners get: camera only{" "}
              {result.rules.cameraOnly ? "yes" : "NO"}, face matched to the document{" "}
              {result.rules.faceMatch ? "yes" : "NO"}, documents accepted:{" "}
              {result.rules.documents.join(", ") || "none"}.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
