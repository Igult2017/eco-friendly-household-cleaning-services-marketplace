import { SignUp } from "@clerk/nextjs"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#F4FAF6] flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <Image src="/logo.png" alt="DORIXÉ" width={180} height={48} className="mx-auto" priority />
      </div>
      <SignUp />
      <Link
        href="/"
        className="mt-6 flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#2D7A5F] transition-colors"
      >
        <ArrowLeft size={14} /> Back to homepage
      </Link>
    </div>
  )
}
