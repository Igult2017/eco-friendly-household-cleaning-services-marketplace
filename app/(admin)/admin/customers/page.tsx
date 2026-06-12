export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { users, bookings } from "@/lib/db/schema"
import { eq, desc, count, sql } from "drizzle-orm"

export default async function AdminCustomersPage() {
  let customers: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    createdAt: Date
    isActive: boolean
    gdprConsentAt: Date | null
    bookingCount: number
  }[] = []

  let errorMsg: string | null = null

  try {
    customers = await db
      .select({
        id:           users.id,
        email:        users.email,
        firstName:    users.firstName,
        lastName:     users.lastName,
        createdAt:    users.createdAt,
        isActive:     users.isActive,
        gdprConsentAt: users.gdprConsentAt,
        bookingCount: count(bookings.id).as("booking_count"),
      })
      .from(users)
      .leftJoin(bookings, eq(bookings.customerId, users.id))
      .where(eq(users.role, "customer"))
      .groupBy(
        users.id,
        users.email,
        users.firstName,
        users.lastName,
        users.createdAt,
        users.isActive,
        users.gdprConsentAt,
      )
      .orderBy(desc(users.createdAt))
      .limit(200)
  } catch (err) {
    console.error("[AdminCustomersPage]", err)
    errorMsg = "Failed to load customers. Check server logs for details."
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Customers</h1>
        <p className="mt-1 text-sm text-[#6B7280]">{customers.length} registered customers</p>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Email", "Bookings", "GDPR consent", "Status", "Joined"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-medium text-[#2B3441]">{c.firstName} {c.lastName}</td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">{c.email}</td>
                <td className="px-4 py-3 text-sm font-semibold text-[#2B3441]">
                  {c.bookingCount > 0 ? (
                    <span className={c.bookingCount >= 2 ? "text-[#2D7A5F]" : ""}>{c.bookingCount}</span>
                  ) : (
                    <span className="text-[#9CA3AF]">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {c.gdprConsentAt ? new Date(c.gdprConsentAt).toLocaleDateString("de-DE") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {new Date(c.createdAt).toLocaleDateString("de-DE")}
                </td>
              </tr>
            ))}
            {customers.length === 0 && !errorMsg && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-[#6B7280]">No customers yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
