import { db } from "@/lib/db"
import { emailCampaigns, emailSends } from "@/lib/db/schema"
import { desc, sql } from "drizzle-orm"
import { Mail, Send, AlertTriangle, MailOpen, MousePointerClick, Bot } from "lucide-react"
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
      // "Left our hands" — every status past queued, since a delivered/opened email was also sent.
      // Counting only status='sent' would make the number DROP as feedback arrives, which reads as
      // emails going missing.
      sent: sql<number>`cast(count(*) filter (where ${emailSends.status} in ('sent','delivered','opened','clicked')) as int)`,
      failed: sql<number>`cast(count(*) filter (where ${emailSends.status} = 'failed') as int)`,
      welcomes: sql<number>`cast(count(*) filter (where ${emailSends.type} = 'welcome' and ${emailSends.status} <> 'failed') as int)`,
      // Reported by Resend once it knows what happened (app/api/webhooks/resend/route.ts).
      opened: sql<number>`cast(count(*) filter (where ${emailSends.status} in ('opened','clicked')) as int)`,
      clicked: sql<number>`cast(count(*) filter (where ${emailSends.status} = 'clicked') as int)`,
      bounced: sql<number>`cast(count(*) filter (where ${emailSends.status} = 'bounced') as int)`,
      complained: sql<number>`cast(count(*) filter (where ${emailSends.status} = 'complained') as int)`,
      aiFailed: sql<number>`cast(count(*) filter (where ${emailSends.aiFailed}) as int)`,
    })
    .from(emailSends)
  const campaigns = await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt)).limit(50)

  const sent = stats?.sent ?? 0
  const pct = (n: number) => (sent > 0 ? `${Math.round((n / sent) * 100)}%` : "—")

  const kpis = [
    { label: "Emails sent", value: sent, icon: Send, color: "#2D7A5F" },
    { label: "Opened", value: `${stats?.opened ?? 0} (${pct(stats?.opened ?? 0)})`, icon: MailOpen, color: "#2563EB" },
    { label: "Clicked", value: `${stats?.clicked ?? 0} (${pct(stats?.clicked ?? 0)})`, icon: MousePointerClick, color: "#7C3AED" },
    { label: "Bounced / spam", value: (stats?.bounced ?? 0) + (stats?.complained ?? 0), icon: AlertTriangle, color: "#DC2626" },
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

      {(stats?.aiFailed ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Bot size={18} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              {stats?.aiFailed} email{(stats?.aiFailed ?? 0) === 1 ? " was" : "s were"} sent without AI writing
            </p>
            <p className="mt-1 text-amber-800">
              The AI could not write {(stats?.aiFailed ?? 0) === 1 ? "it" : "them"}, so a fixed template went out instead.
              This is almost always a missing or expired <code className="font-mono text-xs">GEMINI_API_KEY</code>.
              Recipients still got a proper email — just not a personalised one. Details are in{" "}
              <a href="/admin/errors" className="underline font-medium hover:text-amber-950 transition-colors">Errors</a>.
            </p>
          </div>
        </div>
      )}

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
          <div className="overflow-x-auto -mx-px"><table className="w-full text-sm">
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
          </table></div>
        )}
      </div>
    </div>
  )
}
