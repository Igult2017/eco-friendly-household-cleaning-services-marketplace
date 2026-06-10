export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { UserRoleManager } from "@/components/admin/UserRoleManager"

export default async function AdminUsersPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (!me || me.role !== "admin") redirect("/")

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      createdAt: users.createdAt,
      isActive: users.isActive,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(500)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Users</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          {allUsers.length} total · manage roles and accounts
        </p>
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {allUsers.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50/50 ${u.id === userId ? "bg-purple-50/40" : ""}`}>
                <td className="px-4 py-3 text-sm font-medium text-[#2B3441]">
                  {u.firstName} {u.lastName}
                  {u.id === userId && <span className="ml-2 text-[10px] text-purple-500 font-semibold">(you)</span>}
                </td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">{u.email}</td>
                <td className="px-4 py-3 text-sm text-[#6B7280] capitalize">{u.role ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {new Date(u.createdAt).toLocaleDateString("de-DE")}
                </td>
                <td className="px-4 py-3">
                  <UserRoleManager
                    userId={u.id}
                    currentRole={u.role as "admin" | "customer" | "provider" | null}
                    isSelf={u.id === userId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
