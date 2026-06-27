"use client"

import { useState } from "react"
import { Trash2, Loader2, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Branded confirmation for permanently deleting a cleaner. Replaces the native window.confirm():
 * styled to the DORIXÉ system, red destructive action, spinner while deleting, and the API's own
 * error message shown inline (e.g. "this cleaner has bookings — suspend instead").
 */
export function DeleteCleanerDialog({
  id,
  name,
  onDeleted,
}: {
  id: string
  name: string
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/providers/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || "Could not delete this cleaner. Please try again.")
        setDeleting(false)
        return
      }
      setDeleting(false)
      setOpen(false)
      onDeleted()
    } catch {
      setError("Network error — check your connection and try again.")
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        title="Delete permanently"
        aria-label={`Delete ${name}`}
        className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!deleting) setOpen(o) }}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </span>
              <div className="space-y-1.5">
                <DialogTitle>Delete this cleaner?</DialogTitle>
                <DialogDescription>
                  This permanently removes{" "}
                  <span className="font-semibold text-foreground">{name}</span> and their account from
                  DORIXÉ — profile, bids, and login are all erased. This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Delete cleaner
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
