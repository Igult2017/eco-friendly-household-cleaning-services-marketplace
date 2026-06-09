"use client"

import { Link2, Check } from "lucide-react"
import { useState } from "react"

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const encoded = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-[#6B7280]">Share:</span>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encoded}`}
        target="_blank" rel="noopener noreferrer"
        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-black text-white hover:opacity-80 transition-opacity"
      >
        X / Twitter
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
        target="_blank" rel="noopener noreferrer"
        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#1877F2] text-white hover:opacity-80 transition-opacity"
      >
        Facebook
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
        target="_blank" rel="noopener noreferrer"
        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#0A66C2] text-white hover:opacity-80 transition-opacity"
      >
        LinkedIn
      </a>
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-[#2B3441] hover:bg-gray-200 transition-colors"
      >
        {copied ? <Check size={12} className="text-green-600" /> : <Link2 size={12} />}
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  )
}
