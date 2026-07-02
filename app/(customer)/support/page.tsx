export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { LifeBuoy } from "lucide-react"
import { MessageThread } from "@/components/messaging/MessageThread"

// In-app support channel (client side): one ongoing thread with the DORIXÉ team.
export default async function CustomerSupportPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const t = await getTranslations("customerSupportPage")

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441] flex items-center gap-2">
          <LifeBuoy size={26} className="text-[#2D7A5F]" /> {t("title")}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subtitle")}</p>
      </div>
      <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-4">
        <MessageThread
          bookingId="support"
          currentUserId={userId}
          endpoint="/api/support/messages"
          channel={`private-customer-${userId}`}
        />
      </div>
    </div>
  )
}
