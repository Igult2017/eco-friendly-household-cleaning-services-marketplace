"use client"

// Persistent control so visitors can re-open the consent banner to change or withdraw consent
// at any time (required for valid, withdrawable consent under GDPR/ePrivacy).
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("dorix-open-cookie-settings"))}
      className="hover:text-white transition-colors underline-offset-2 hover:underline"
    >
      {label}
    </button>
  )
}
