import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#F4FAF6] flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <p className="font-serif text-3xl font-bold text-[#2B3441]">DORIX</p>
        <p className="text-sm text-[#6B7280] mt-1">Clean home. Green future.</p>
      </div>
      <SignIn />
    </div>
  )
}
