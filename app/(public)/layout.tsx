import { GoogleOneTap } from "@clerk/nextjs"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <GoogleOneTap />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
