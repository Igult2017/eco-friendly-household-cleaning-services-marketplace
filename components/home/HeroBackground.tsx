"use client"

import { useEffect, useState } from "react"

// Full-bleed hero background: the cleaning photos gently crossfade. Image 1 is
// rendered visible on the server (no blank flash / good LCP); the rest fade in on
// a timer. Respects prefers-reduced-motion (then it just shows the first photo).
const IMAGES = [
  "/hero/hero-clean-1.jpg",
  "/hero/hero-clean-2.jpg",
  "/hero/hero-clean-3.jpg",
  "/hero/hero-clean-4.jpg",
  "/hero/hero-clean-5.jpg",
  "/hero/hero-clean-6.jpg",
  "/hero/hero-clean-7.jpg",
]

export function HeroBackground() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => setActive((i) => (i + 1) % IMAGES.length), 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          fetchPriority={i === 0 ? "high" : "low"}
          className={`absolute inset-0 -z-20 h-full w-full object-cover object-center transition-opacity duration-1000 ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </>
  )
}
