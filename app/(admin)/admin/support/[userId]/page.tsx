import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { MessageThread } from "@/components/messaging/MessageThread"

// Admin view of one user's support thread — reply notifies the user in-app + by email.
export default async function AdminSupportThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: adminId } = await auth()
  if (!adminId) redirect("/sign-in")
  const { userId } = await params

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-5">
      <Link href="/admin/support" className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#2B3441]">
        <ChevronLeft size={14} /> Support inbox
      </Link>
      <div className="rounded-2xl bg-white border border-[#E5EBF0] p-4">
        {/* channel: private-admin is auth-valid for admins; the thread refreshes via its 5s poll. */}
        <MessageThread bookingId={`support-${userId}`} currentUserId={adminId} endpoint={`/api/admin/support/${userId}`} channel="private-admin" />
      </div>
    </main>
  )
}
