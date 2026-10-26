"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Loader2, Clock, ShieldCheck, ShieldOff, Check } from "lucide-react"
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
 * Identity check settings, plus a way for the admin to run the exact check cleaners get.
 *
 * Every choice is on screen at once, not hidden inside a dropdown, and the one in force is filled,
 * outlined and ticked. The first version used two <select> menus: the alternatives were invisible
 * until opened, and a menu reading "On — cleaners must verify" is ambiguous — it looks equally like
 * a statement of what IS and a thing you are about to choose. A setting that decides whether
 * strangers are identity-checked before entering someone's home must never be ambiguous.
 *
 * `savedCfg` is what the server last gave us, so an unsaved change is named outright instead of
 * leaving the admin to assume that clicking was enough. It is not — Save still has to be pressed.
 */
export function IdentitySection({
  cfg,
  set,
  savedCfg = {},
}: {
  cfg: Config
  set: SetFn
  savedCfg?: Config
}) {
  const enabled = cfg.identity_enabled ?? "on"
  const mode = cfg.identity_mode ?? "first_job"
  const isOn = enabled === "on"

  const enabledDirty = (savedCfg.identity_enabled ?? "on") !== enabled
  const modeDirty = (savedCfg.identity_mode ?? "first_job") !== mode

  const [result, setResult] = useState<TestResult | null>(null)
  const [checking, setChecking] = useState(false)

  async function readResult(sessionId?: string) {
    if (!sessionId) return
    setChecking(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/identity-test?sessionId=${encodeURIComponent(sessionId)}`)
      if (res.ok) setResult(await res.json())
    } catch { /* show nothing rather than a false verdict */ } finally {
      setChecking(false)
    }
  }

  return (
    <>
      {/* ---------------- On / off ---------------- */}
      <div className="px-6 py-5">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-[#2B3441]">Identity Checks for Cleaners</label>
          <StateBadge on={isOn} />
          {enabledDirty && <UnsavedBadge />}
        </div>
        <p className="mb-4 text-xs leading-relaxed text-[#6B7280]">
          Cleaners photograph an ID with their camera and take a photo of their face, which is matched
          against the document.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Identity checks on or off">
          <ChoiceCard
            selected={isOn}
            onSelect={() => set("identity_enabled", "on")}
            icon={<ShieldCheck className="h-4 w-4 text-[#2D7A5F]" />}
            title="On"
            subtitle="Cleaners must verify their identity"
            detail="Nobody can start a job until they have passed."
          />
          <ChoiceCard
            selected={!isOn}
            onSelect={() => set("identity_enabled", "off")}
            icon={<ShieldOff className="h-4 w-4 text-amber-600" />}
            title="Off"
            subtitle="Nobody is asked to verify"
            detail="Also frees any cleaner currently waiting on a check, so no one is left stuck."
            tone="warn"
          />
        </div>
      </div>

      {/* ---------------- When ---------------- */}
      <div className={`px-6 py-5 ${isOn ? "" : "opacity-60"}`}>
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-[#2B3441]">When Cleaners Verify</label>
          {isOn && <CurrentBadge text={mode === "first_job" ? "At their first job" : "Right after signing up"} />}
          {isOn && modeDirty && <UnsavedBadge />}
        </div>
        <p className="mb-4 text-xs leading-relaxed text-[#6B7280]">
          {isOn
            ? "Each cleaner only ever does this once, whichever you pick. Either way, a cleaner who skipped it is still stopped at their first job."
            : "Identity checks are off, so nobody is asked. Turn them on above to choose when."}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="When cleaners verify">
          <ChoiceCard
            selected={isOn && mode === "first_job"}
            disabled={!isOn}
            onSelect={() => set("identity_mode", "first_job")}
            title="At their first job"
            subtitle="Booking, winning a bid, or an urgent task"
            detail="You only pay for cleaners who actually get work."
            badge="Cheapest"
          />
          <ChoiceCard
            selected={isOn && mode === "onboarding"}
            disabled={!isOn}
            onSelect={() => set("identity_mode", "onboarding")}
            title="Right after signing up"
            subtitle="Before they can do anything else"
            detail="Every cleaner is already checked — but you pay for ones who may never take a job."
          />
        </div>
      </div>

      {/* ---------------- Try it ---------------- */}
      <div className="px-6 py-5">
        <label className="mb-1 block text-sm font-semibold text-[#2B3441]">Try It Yourself</label>
        <p className="mb-3 text-xs leading-relaxed text-[#6B7280]">
          Runs the <strong>exact check a cleaner gets</strong> — same camera, same face match, same
          accepted documents — so you can confirm it works before the first cleaner reaches it. Your
          result is <strong>never</strong> recorded against any cleaner&apos;s account.
          <br />
          <span className="text-[#9CA3AF]">
            Stripe charges about $1.50 for each check you actually submit, pass or fail. Your first 50
            are free and none have been used. Opening this and closing it again costs nothing.
          </span>
        </p>

        <IdentityVerifyModal endpoint="/api/admin/identity-test" hideJobWarning onVerified={readResult} />

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

/**
 * One choice, always visible. The live one is filled, outlined AND ticked — three signals rather
 * than one, so it reads at a glance and does not depend on seeing colour.
 */
function ChoiceCard({
  selected, disabled = false, onSelect, title, subtitle, detail, icon, badge, tone = "ok",
}: {
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  title: string
  subtitle: string
  detail: string
  icon?: React.ReactNode
  badge?: string
  tone?: "ok" | "warn"
}) {
  const ring = selected
    ? tone === "warn"
      ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300"
      : "border-[#2D7A5F] bg-[#F4FAF6] ring-1 ring-[#2D7A5F]"
    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5"

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D7A5F] disabled:cursor-not-allowed disabled:hover:translate-y-0 ${ring}`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected
            ? tone === "warn" ? "border-amber-500 bg-amber-500 text-white" : "border-[#2D7A5F] bg-[#2D7A5F] text-white"
            : "border-gray-300 bg-white"
        }`}
        aria-hidden="true"
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-[#2B3441]">{title}</span>
          {badge && (
            <span className="rounded-full bg-[#EDF5F0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2D7A5F]">
              {badge}
            </span>
          )}
          {selected && (
            <span className="rounded-full bg-[#2B3441] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Selected
            </span>
          )}
        </span>
        <span className="mt-1 block text-xs font-medium text-[#2B3441]">{subtitle}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[#6B7280]">{detail}</span>
      </span>
    </button>
  )
}

/** What is live RIGHT NOW, in words, next to the heading. */
function StateBadge({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        on ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-green-600" : "bg-amber-600"}`} aria-hidden="true" />
      {on ? "ON — cleaners must verify" : "OFF — nobody is asked"}
    </span>
  )
}

function CurrentBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF5F0] px-2.5 py-1 text-[11px] font-semibold text-[#2D7A5F]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#2D7A5F]" aria-hidden="true" />
      {text}
    </span>
  )
}

/** Pressing a card changes nothing until Save is pressed. Saying so stops a silent no-op. */
function UnsavedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
      Not saved yet — press Save Settings below
    </span>
  )
}
