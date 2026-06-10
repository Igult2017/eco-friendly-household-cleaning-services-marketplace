"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ProviderFieldValues {
  businessName: string
  bio: string
  city: string
  postalCode: string
  country: string
  serviceRadiusKm: string
  ecoLevel: string
}

interface Props {
  values: ProviderFieldValues
  onChange: (key: keyof ProviderFieldValues, value: string) => void
}

const EU_COUNTRIES: [string, string][] = [
  ["DE", "Germany"], ["NL", "Netherlands"], ["BE", "Belgium"], ["AT", "Austria"],
  ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["PL", "Poland"],
  ["SE", "Sweden"], ["DK", "Denmark"], ["FI", "Finland"], ["NO", "Norway"],
  ["CH", "Switzerland"], ["PT", "Portugal"], ["IE", "Ireland"],
]

const ECO_LEVELS: [string, string][] = [
  ["basic", "Basic — eco-aware products"],
  ["certified", "Certified — verified green products"],
  ["premium", "Premium — zero-toxin only"],
  ["zero_impact", "Zero Impact — carbon-neutral operations"],
]

export function ProviderFields({ values, onChange }: Props) {
  return (
    <div className="space-y-4 border-t border-[#E5EDE9] pt-5">
      <p className="text-xs font-semibold text-[#2D7A5F] uppercase tracking-wide">Business info</p>

      <div>
        <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">Business / trading name *</Label>
        <Input value={values.businessName} onChange={e => onChange("businessName", e.target.value)} placeholder="e.g. GreenSpark Cleaning" />
      </div>

      <div>
        <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">About you *</Label>
        <Textarea
          value={values.bio}
          onChange={e => onChange("bio", e.target.value)}
          placeholder="Describe your experience and eco approach (min 20 characters)..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">City *</Label>
          <Input value={values.city} onChange={e => onChange("city", e.target.value)} placeholder="Amsterdam" />
        </div>
        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">Postal code *</Label>
          <Input value={values.postalCode} onChange={e => onChange("postalCode", e.target.value)} placeholder="1012 AB" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">Country *</Label>
          <Select value={values.country} onValueChange={v => onChange("country", v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EU_COUNTRIES.map(([code, name]) => (
                <SelectItem key={code} value={code}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">Service radius (km) *</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={values.serviceRadiusKm}
            onChange={e => onChange("serviceRadiusKm", e.target.value)}
            placeholder="25"
          />
        </div>
      </div>

      <div>
        <Label className="text-[#2B3441] text-sm font-medium mb-1.5 block">Eco level *</Label>
        <Select value={values.ecoLevel} onValueChange={v => onChange("ecoLevel", v)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ECO_LEVELS.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
