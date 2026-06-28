"use client"

import { useState } from "react"
import { Globe, Copy, Check } from "lucide-react"

const PRESETS = [
  { label: "Home", path: "/" },
  { label: "Find cleaners", path: "/browse" },
  { label: "Eco-store", path: "/eco-store" },
  { label: "Become a cleaner", path: "/become-a-cleaner" },
  { label: "How it works", path: "/how-it-works" },
  { label: "Sustainability", path: "/sustainability" },
  { label: "Blog", path: "/blog" },
]

// Append the affiliate's ref code to any page path → a full shareable URL. Attribution works on EVERY
// page (the middleware reads ?ref on any request), so affiliates can promote the most relevant landing
// page, not just the homepage.
function buildRef(origin: string, code: string, rawPath: string): string {
  if (!code || !origin) return ""
  let p = (rawPath || "/").trim()
  if (!p.startsWith("/")) p = "/" + p
  p = p.replace(/([?&])ref=[^&]*/i, "$1").replace(/[?&]+$/, "") // drop any ref the user pasted
  const sep = p.includes("?") ? "&" : "?"
  return `${origin}${p}${sep}ref=${code}`
}

export function ReferralLinkBuilder({ code, origin }: { code: string; origin: string }) {
  const [path, setPath] = useState("/")
  const [copied, setCopied] = useState(false)
  const link = buildRef(origin, code, path)

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-6">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-4 w-4 text-[#2D7A5F]" />
        <h2 className="font-semibold text-[#2B3441]">Promote any page</h2>
      </div>
      <p className="text-sm text-[#6B7280] mb-4">
        Your code works on <span className="font-medium text-[#2B3441]">any</span> DORIXÉ page — send your
        audience to the most relevant one. Pick a page or paste a path (e.g. a specific cleaner or article).
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.path}
            type="button"
            onClick={() => setPath(p.path)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
              path === p.path
                ? "bg-[#2D7A5F] text-white border-[#2D7A5F]"
                : "bg-white text-[#6B7280] border-[#E5EBF0] hover:border-[#2D7A5F] hover:text-[#2D7A5F]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Page path</label>
      <input
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder="/eco-store"
        className="w-full font-mono text-sm bg-white border border-[#E5EBF0] rounded-lg px-3 py-2 text-[#2B3441] mb-3 outline-none focus:ring-2 focus:ring-[#2D7A5F]/30"
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 font-mono text-sm bg-[#F4FAF6] border border-[#E5EBF0] rounded-lg px-4 py-3 text-[#2B3441] truncate">
          {link || "—"}
        </div>
        <button
          onClick={copy}
          disabled={!link}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2D7A5F] text-white px-5 py-3 text-sm font-semibold hover:bg-[#235f49] transition-colors disabled:opacity-50"
        >
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
        </button>
      </div>
    </div>
  )
}
