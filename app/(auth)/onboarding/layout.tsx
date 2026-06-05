import Link from "next/link"
import Image from "next/image"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4FAF6] flex flex-col">
      <header className="flex items-center justify-center py-6 border-b border-[#E5EDE9] bg-white">
        <Link href="/">
          <Image src="/logo.png" alt="DORIX" width={110} height={40} priority />
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
