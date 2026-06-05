import { SignUp } from "@clerk/nextjs"
import Image from "next/image"

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#F4FAF6] flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <Image src="/logo.png" alt="DORIX" width={140} height={50} className="mx-auto" priority />
      </div>
      <SignUp />
    </div>
  )
}
