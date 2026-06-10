"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

const ECO_OPTIONS = ["Eco-certified products only", "No single-use plastics", "Fragrance-free", "Energy-saving methods"]

export default function PostJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: "",
    description: "",
    budgetMin: "",
    budgetMax: "",
    desiredDate: "",
    serviceAddress: { line1: "", city: "", postalCode: "", country: "DE" },
    serviceLatitude: 0,
    serviceLongitude: 0,
    radiusKm: 25,
    ecoRequirements: [] as string[],
  })

  function set(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function geocodeAddress() {
    if (!form.serviceAddress.city || !form.serviceAddress.postalCode) return
    setGeocoding(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(form.serviceAddress.postalCode)}&city=${encodeURIComponent(form.serviceAddress.city)}&country=${form.serviceAddress.country}&limit=1`, { headers: { "Accept-Language": "en" } })
      const data = await res.json()
      if (data[0]) {
        setForm((prev) => ({ ...prev, serviceLatitude: parseFloat(data[0].lat), serviceLongitude: parseFloat(data[0].lon) }))
      }
    } finally {
      setGeocoding(false)
    }
  }

  function toggleEco(opt: string) {
    setForm((prev) => ({
      ...prev,
      ecoRequirements: prev.ecoRequirements.includes(opt) ? prev.ecoRequirements.filter((x) => x !== opt) : [...prev.ecoRequirements, opt],
    }))
  }

  function extractError(payload: unknown): string {
    if (typeof payload === "string") return payload
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>
      const formErrs = Array.isArray(p.formErrors) ? p.formErrors : []
      const fieldErrs = p.fieldErrors && typeof p.fieldErrors === "object"
        ? Object.values(p.fieldErrors as Record<string, string[]>).flat()
        : []
      const all = [...formErrs, ...fieldErrs].filter(Boolean)
      if (all.length) return all.join(" · ")
    }
    return "Something went wrong. Please try again."
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.serviceLatitude) { setError("Please fill in city and postal code so we can locate your address."); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          budgetMin: form.budgetMin ? parseInt(form.budgetMin) * 100 : undefined,
          budgetMax: form.budgetMax ? parseInt(form.budgetMax) * 100 : undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(extractError(d.error))
        return
      }
      setSuccess(true)
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F4FAF6] flex flex-col items-center justify-center px-4 py-20">
        <div className="w-16 h-16 bg-[#D1F0E0] rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-[#2D7A5F]" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] text-center mb-2">Job Posted!</h1>
        <p className="text-[#6B7280] text-center mb-8 max-w-sm">Providers near you have been notified. Check your bids in My Jobs.</p>
        <div className="flex gap-3">
          <Button onClick={() => router.push("/jobs")} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">View My Jobs</Button>
          <Button variant="outline" onClick={() => { setSuccess(false); setForm({ title: "", description: "", budgetMin: "", budgetMax: "", desiredDate: "", serviceAddress: { line1: "", city: "", postalCode: "", country: "DE" }, serviceLatitude: 0, serviceLongitude: 0, radiusKm: 25, ecoRequirements: [] }) }} className="border-[#E5EBF0]">Post Another</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">Post a Cleaning Job</h1>
        <p className="text-[#6B7280] mb-8">Describe what you need — providers will bid on your job</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5 space-y-4">
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">Job title *</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Deep clean 3-bedroom apartment" required minLength={5} />
            </div>
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">Description *</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What do you need cleaned? Any special requirements? Access instructions?" rows={4} required minLength={20} className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">Budget min (€)</Label>
                <Input type="number" value={form.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} placeholder="50" min={1} />
              </div>
              <div>
                <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">Budget max (€)</Label>
                <Input type="number" value={form.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} placeholder="150" min={1} />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold text-[#2B3441] mb-1.5 block">Desired date</Label>
              <Input type="date" value={form.desiredDate} onChange={(e) => set("desiredDate", e.target.value)} min={new Date().toISOString().split("T")[0]} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5 space-y-4">
            <h2 className="font-semibold text-[#2B3441]">Service location</h2>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">Street address</Label>
              <Input value={form.serviceAddress.line1} onChange={(e) => setForm((p) => ({ ...p, serviceAddress: { ...p.serviceAddress, line1: e.target.value } }))} placeholder="Hauptstraße 42" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">City *</Label>
                <Input value={form.serviceAddress.city} onChange={(e) => setForm((p) => ({ ...p, serviceAddress: { ...p.serviceAddress, city: e.target.value } }))} placeholder="Berlin" required onBlur={geocodeAddress} />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">Postal code *</Label>
                <Input value={form.serviceAddress.postalCode} onChange={(e) => setForm((p) => ({ ...p, serviceAddress: { ...p.serviceAddress, postalCode: e.target.value } }))} placeholder="10115" required onBlur={geocodeAddress} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              <MapPin size={13} className={form.serviceLatitude ? "text-[#2D7A5F]" : "text-[#9CA3AF]"} />
              {geocoding ? "Locating..." : form.serviceLatitude ? `Located: ${form.serviceLatitude.toFixed(4)}, ${form.serviceLongitude.toFixed(4)}` : "Fill in city and postal code to auto-locate"}
            </div>
            <div>
              <Label className="text-sm font-medium text-[#2B3441] mb-1.5 block">Provider search radius: {form.radiusKm} km</Label>
              <input type="range" min={5} max={100} value={form.radiusKm} onChange={(e) => set("radiusKm", parseInt(e.target.value))} className="w-full accent-[#2D7A5F]" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5">
            <h2 className="font-semibold text-[#2B3441] mb-3">Eco requirements</h2>
            <div className="space-y-2">
              {ECO_OPTIONS.map((opt) => (
                <label key={opt} className={cn("flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all", form.ecoRequirements.includes(opt) ? "border-[#2D7A5F] bg-[#F4FAF6]" : "border-[#E5EBF0] hover:border-[#4CB87A]")}>
                  <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 text-white text-xs", form.ecoRequirements.includes(opt) ? "border-[#2D7A5F] bg-[#2D7A5F]" : "border-[#9CA3AF]")}>
                    {form.ecoRequirements.includes(opt) && "✓"}
                  </div>
                  <input type="checkbox" className="hidden" checked={form.ecoRequirements.includes(opt)} onChange={() => toggleEco(opt)} />
                  <span className="text-sm text-[#2B3441]">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full h-12 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold">
            {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Posting...</> : "Post Job & Get Bids"}
          </Button>
        </form>
      </div>
    </div>
  )
}
