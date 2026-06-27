"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"

/** Dynamic add/remove text rows for starter-pack selling points → string[]. */
export function BenefitsEditor({
  benefits,
  onChange,
}: {
  benefits: string[]
  onChange: (next: string[]) => void
}) {
  const rows = benefits.length ? benefits : [""]

  function update(i: number, val: string) {
    const next = [...rows]
    next[i] = val
    onChange(next)
  }
  function remove(i: number) {
    const next = rows.filter((_, idx) => idx !== i)
    onChange(next)
  }
  function add() {
    onChange([...rows, ""])
  }

  return (
    <div className="space-y-1.5">
      <Label>Benefits (starter pack selling points)</Label>
      <div className="space-y-2">
        {rows.map((b, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={b}
              onChange={(e) => update(i, e.target.value)}
              placeholder={`Benefit ${i + 1}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => remove(i)}
              aria-label={`Remove benefit ${i + 1}`}
              className="h-8 w-8 shrink-0 p-0 text-[#9CA3AF] hover:text-red-600 hover:bg-red-50"
            >
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="mt-1 gap-1">
        <Plus size={14} /> Add benefit
      </Button>
    </div>
  )
}
