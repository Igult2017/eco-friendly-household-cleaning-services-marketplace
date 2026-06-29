"use client"

import { Printer } from "lucide-react"

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-semibold px-4 py-2.5 transition-colors print:hidden"
    >
      <Printer size={15} /> {label}
    </button>
  )
}
