"use client"

import { useEffect, useState } from "react"

// Full-bleed hero background: cleaning photos gently crossfade. Image 1 renders on the server
// (good LCP, no blank flash). The rest are loaded ONE STEP AHEAD of the crossfade rather than all
// at once — so the hero costs ~75KB upfront (image 1) instead of ~500KB (all seven). WebP keeps
// each frame small. Respects prefers-reduced-motion (then it just shows the first photo).
const IMAGES = [
  "/hero/hero-clean-1.webp",
  "/hero/hero-clean-2.webp",
  "/hero/hero-clean-3.webp",
  "/hero/hero-clean-4.webp",
  "/hero/hero-clean-5.webp",
  "/hero/hero-clean-6.webp",
  "/hero/hero-clean-7.webp",
]

export function HeroBackground() {
  const [active, setActive] = useState(0)
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0]))

  // Crossfade timer (skipped for reduced-motion — only image 1 ever shows/loads).
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => setActive((i) => (i + 1) % IMAGES.length), 5000)
    return () => clearInterval(id)
  }, [])

  // Preload only the next frame, one step ahead of the transition.
  useEffect(() => {
    const next = (active + 1) % IMAGES.length
    setLoaded((s) => (s.has(next) ? s : new Set(s).add(next)))
  }, [active])

  return (
    <>
      {IMAGES.map((src, i) => (
        <img
          key={src}
          src={loaded.has(i) ? src : undefined}
          alt=""
          aria-hidden="true"
          fetchPriority={i === 0 ? "high" : "low"}
          decoding="async"
          className={`absolute inset-0 -z-20 h-full w-full object-cover object-center transition-opacity duration-1000 ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </>
  )
}
