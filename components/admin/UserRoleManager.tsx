"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useClerk } from "@clerk/nextjs"
import { Trash2 } from "lucide-react"

type Role = "admin" | "customer" | "provider"

const ROLE_COLORS: Record<Role, string> = {
  admin:    "bg-purple-100 text-purple-700",
  customer: "bg-blue-100 text-blue-700",
  provider: "bg-green-100 text-green-700",
}

export function UserRoleManager({
  userId,
  currentRole,
  isSelf,
}: {
  userId: string
  currentRole: Role | null
  isSelf: boolean
}) {
  const router = useRouter()
  const { signOut } = useClerk()
  const [role, setRole] = useState<Role | null>(currentRole)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function changeRole(newRole: Role) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setRole(newRole)
      router.refresh()
    } catch {
      setError("Request failed")
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser() {
    const label = isSelf ? "your own account" : "this user"
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setDeleting(false); return }
      if (data.self) {
        await signOut({ redirectUrl: "/" })
      } else {
        router.refresh()
      }
    } catch {
      setError("Request failed")
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role ?? ""}
        disabled={saving}
        onChange={(e) => changeRole(e.target.value as Role)}
        className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 outline-none cursor-pointer ${role ? ROLE_COLORS[role] : "bg-gray-100 text-gray-500"}`}
      >
        {!role && <option value="">— no role —</option>}
        <option value="admin">admin</option>
        <option value="customer">customer</option>
        <option value="provider">provider</option>
      </select>

      <button
        onClick={deleteUser}
        disabled={deleting}
        title={isSelf ? "Delete my account" : "Delete user"}
        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
      >
        <Trash2 size={14} />
      </button>

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
