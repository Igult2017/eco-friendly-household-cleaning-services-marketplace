import { CheckCircle2, AlertCircle, Users2 } from "lucide-react"
import { owedCents, type ReferrerRow } from "@/lib/admin/referralPerformance"

const money = (cents: number) => `€${(cents / 100).toFixed(2)}`

// One person per row: how many people they brought, how many of those actually turned into money,
// what they have earned, and — the column that matters for paying anyone — what is still owed.
// The old page listed one row per REFERRED person, so nobody's totals appeared anywhere.
export function ReferrerTable({
  title,
  blurb,
  rows,
  note,
  showPayoutReady = true,
  emptyHint,
}: {
  title: string
  blurb: string
  rows: ReferrerRow[]
  note?: string
  showPayoutReady?: boolean
  emptyHint: string
}) {
  const totalOwed = rows.reduce((a, r) => a + owedCents(r), 0)
  const totalBrought = rows.reduce((a, r) => a + r.brought, 0)

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#2B3441]">{title}</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">{blurb}</p>
        </div>
        {rows.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-[#6B7280]">Owed in total</p>
            <p className="text-lg font-bold text-[#2B3441] tabular-nums">{money(totalOwed)}</p>
          </div>
        )}
      </div>

      {note && <p className="px-5 py-3 text-xs text-[#6B7280] bg-gray-50 border-b border-gray-100">{note}</p>}

      {rows.length === 0 ? (
        <div className="p-10 text-center">
          <Users2 size={28} className="mx-auto text-[#9CA3AF]" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-[#2B3441]">Nobody here yet</p>
          <p className="mt-1 text-xs text-[#6B7280] max-w-md mx-auto">{emptyHint}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#6B7280] border-b border-gray-100">
                <th scope="col" className="px-5 py-3 font-medium">Person</th>
                <th scope="col" className="px-3 py-3 font-medium">Code</th>
                <th scope="col" className="px-3 py-3 font-medium text-right">Brought</th>
                <th scope="col" className="px-3 py-3 font-medium text-right">Converted</th>
                <th scope="col" className="px-3 py-3 font-medium text-right">Earned</th>
                <th scope="col" className="px-3 py-3 font-medium text-right">Owed now</th>
                <th scope="col" className="px-3 py-3 font-medium text-right">Paid out</th>
                {showPayoutReady && <th scope="col" className="px-5 py-3 font-medium">Can be paid</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rate = r.brought > 0 ? Math.round((r.converted / r.brought) * 100) : null
                const owed = owedCents(r)
                return (
                  <tr key={r.userId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#2B3441]">{r.name}</p>
                      <p className="text-xs text-[#6B7280]">{r.email ?? "—"}</p>
                    </td>
                    <td className="px-3 py-3">
                      {r.code
                        ? <code className="text-xs font-mono bg-gray-100 rounded px-1.5 py-0.5 text-[#2B3441]">{r.code}</code>
                        : <span className="text-xs text-[#9CA3AF]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#2B3441]">{r.brought}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#2B3441]">
                      {r.converted}
                      {rate !== null && <span className="ml-1 text-xs text-[#6B7280]">({rate}%)</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#2B3441]">{money(r.earnedCents)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#2B3441]">
                      {money(owed)}
                      {r.pendingCents > 0 && (
                        <span className="block text-xs font-normal text-[#6B7280]">
                          {money(r.pendingCents)} not settled yet
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#6B7280]">{money(r.paidOutCents)}</td>
                    {showPayoutReady && (
                      <td className="px-5 py-3">
                        {r.payoutReady ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                            <CheckCircle2 size={12} aria-hidden="true" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                            <AlertCircle size={12} aria-hidden="true" />
                            {owed > 0 ? "No payout account" : "Not set up"}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 text-sm font-semibold text-[#2B3441]">
                <td className="px-5 py-3" colSpan={2}>{rows.length} {rows.length === 1 ? "person" : "people"}</td>
                <td className="px-3 py-3 text-right tabular-nums">{totalBrought}</td>
                <td className="px-3 py-3" />
                <td className="px-3 py-3" />
                <td className="px-3 py-3 text-right tabular-nums">{money(totalOwed)}</td>
                <td className="px-3 py-3" />
                {showPayoutReady && <td className="px-5 py-3" />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
