export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export default async function AdminCustomersPage() {
  const customers = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, createdAt: users.createdAt, isActive: users.isActive, gdprConsentAt: users.gdprConsentAt })
    .from(users)
    .where(eq(users.role, "customer"))
    .orderBy(desc(users.createdAt))
    .limit(200)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Customers</h1>
        <p className="mt-1 text-sm text-[#6B7280]">{customers.length} registered customers</p>
      </div>
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Email", "GDPR consent", "Status", "Joined"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-medium text-[#2B3441]">{c.firstName} {c.lastName}</td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">{c.email}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{c.gdprConsentAt ? new Date(c.gdprConsentAt).toLocaleDateString("de-DE") : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{new Date(c.createdAt).toLocaleDateString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
