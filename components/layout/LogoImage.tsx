"use client"

import Image from "next/image"
import { useLinkStatus } from "next/link"

// Instant click feedback for the logo (home) link. Even with prefetch enabled, the first click
// (before prefetch settles) or a cold cache can lag ~0.5s while the home RSC is fetched.
// useLinkStatus flips to `pending` the moment the logo is clicked, so it dims immediately — the
// navigation feels responsive instead of "dead". When home was already prefetched the click is
// instant and this barely flashes.
export function LogoImage() {
  const { pending } = useLinkStatus()
  return (
    <Image
      src="/logo.png"
      alt="DORIXÉ"
      width={140}
      height={37}
      priority
      className={`transition-opacity duration-150 ${pending ? "opacity-50" : ""}`}
    />
  )
}
