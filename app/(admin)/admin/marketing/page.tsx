import { db } from "@/lib/db"
import { emailCampaigns, emailSends } from "@/lib/db/schema"
import { desc, sql } from "drizzle-orm"
import { Mail, Send, CheckCircle2, AlertTriangle } from "lucide-react"
import { CampaignComposer } from "@/components/admin/marketing/CampaignComposer"
import { CAMPAIGN_TYPE_LABELS, type CampaignType } from "@/lib/marketing/types"

export const dynamic = "force-dynamic"

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
}

export default async function AdminMarketingPage() {
  const [stats] = await db
    .select({
      sent: sql<number>`cast(count(*) filter (where ${emailSends.status} = 'sent') as int)`,
      failed: sql<number>`cast(count(*) filter (where ${emailSends.status} = 'failed') as int)`,
      welcomes: sql<number>`cast(count(*) filter (where ${emailSends.type} = 'welcome' and ${emailSends.status} = 'sent') as int)`,
    })
    .from(emailSends)
  const campaigns = await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt)).limit(50)

  const kpis = [
    { label: "Emails sent", value: stats?.sent ?? 0, icon: Send, color: "#2D7A5F" },
    { label: "Welcome emails", value: stats?.welcomes ?? 0, icon: Mail, color: "#2563EB" },
    { label: "Campaigns", value: campaigns.length, icon: CheckCircle2, color: "#7C3AED" },
    { label: "Failed", value: stats?.failed ?? 0, icon: AlertTriangle, color: "#DC2626" },
  ]

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EDF5F0] flex items-center justify-center">
          <Mail size={18} className="text-[#2D7A5F]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">Email Marketing</h1>
          <p className="text-sm text-[#6B7280]">AI-written lifecycle &amp; campaign emails. Welcome fires automatically on signup.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <Icon size={18} style={{ color }} />
            <p className="text-2xl font-bold text-[#2B3441] mt-2">{value}</p>
            <p className="text-xs text-[#6B7280]">{label}</p>
          </div>
        ))}
      </div>

      <CampaignComposer />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2B3441]">Campaigns</h2>
        </div>
        {campaigns.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-[#9CA3AF]">No campaigns yet. Compose one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[#6B7280] text-xs uppercase tracking-wide">
              <tr><th className="text-left px-6 py-3">Name</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Sent</th><th className="text-right px-6 py-3">Failed</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-[#2B3441]">{c.name}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{CAMPAIGN_TYPE_LABELS[c.type as CampaignType]}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status] ?? STATUS_COLORS.draft}`}>{c.status}</span></td>
                  <td className="px-4 py-3 text-right text-[#2B3441]">{c.sentCount}</td>
                  <td className="px-6 py-3 text-right text-[#6B7280]">{c.failedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
