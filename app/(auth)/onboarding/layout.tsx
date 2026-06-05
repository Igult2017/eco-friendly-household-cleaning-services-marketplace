import Link from "next/link"
import { Leaf } from "lucide-react"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4FAF6] flex flex-col">
      <header className="flex items-center justify-center py-6 border-b border-[#E5EDE9] bg-white">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#2D7A5F] flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold text-[#2B3441] tracking-tight">DORIX</span>
        </Link>
      </header>
      <main className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>
    </div>
  )
}
