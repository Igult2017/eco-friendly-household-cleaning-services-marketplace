"use client"

import { Star, MapPin, Leaf } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrencyShort, priceUnitSuffix } from "@/lib/utils/formatCurrency"
import type { GeoProvider } from "@/lib/db/queries/geo"
import Image from "next/image"

const ECO_COLORS: Record<string, string> = {
  basic: "bg-[#D1F0E0] text-[#2D7A5F]",
  certified: "bg-[#4CB87A]/20 text-[#2D7A5F]",
  premium: "bg-[#2D7A5F]/20 text-[#235f49]",
  zero_impact: "bg-[#2B3441]/10 text-[#2B3441]",
}

interface Props {
  provider: GeoProvider
  onSelect: (id: string) => void
  selected?: boolean
}

export function ProviderCard({ provider, onSelect, selected }: Props) {
  const distKm = (provider.distanceMeters / 1000).toFixed(1)
  const ecoLabel = provider.ecoLevel.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div
      className={`bg-white rounded-2xl border-2 transition-all p-4 cursor-pointer hover:shadow-md ${
        selected ? "border-[#2D7A5F] shadow-md" : "border-transparent shadow-sm"
      }`}
      onClick={() => onSelect(provider.id)}
    >
      <div className="flex gap-4">
        <div className="relative flex-shrink-0">
          {provider.profilePhotoUrl ? (
            <Image
              src={provider.profilePhotoUrl}
              alt={provider.businessName}
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#D1F0E0] flex items-center justify-center text-[#2D7A5F] text-xl font-bold">
              {provider.businessName[0]}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-[#2B3441] truncate">{provider.businessName}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {provider.averageRating && (
                  <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    {Number(provider.averageRating).toFixed(1)}
                    <span className="text-[#9CA3AF]">({provider.totalReviews})</span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                  <MapPin size={11} />
                  {distKm} km away
                </span>
              </div>
            </div>
            {provider.serviceBasePrice != null && (
              <p className="flex-shrink-0 text-right leading-none">
                <span className="block text-[10px] font-medium text-[#9CA3AF]">From</span>
                <span className="text-lg font-bold text-[#2D7A5F]">{formatCurrencyShort(provider.serviceBasePrice)}</span>
                <span className="text-[11px] font-medium text-[#6B7280]">{priceUnitSuffix[provider.priceUnit ?? "per_job"] ?? ""}</span>
              </p>
            )}
          </div>

          {provider.bio && (
            <p className="text-xs text-[#6B7280] mt-2 line-clamp-2">{provider.bio}</p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge className={`text-xs px-2 py-0.5 ${ECO_COLORS[provider.ecoLevel] ?? ECO_COLORS.basic}`}>
              <Leaf size={11} className="mr-1" />
              {ecoLabel}
            </Badge>
            <span className="text-xs text-[#9CA3AF]">{provider.totalJobsCompleted} jobs done</span>
          </div>
        </div>
      </div>

      <Button
        className={`w-full mt-4 h-9 text-sm transition-colors ${
          selected
            ? "bg-[#2D7A5F] text-white hover:bg-[#235f49]"
            : "bg-[#F4FAF6] text-[#2D7A5F] hover:bg-[#D1F0E0] border border-[#2D7A5F]/30"
        }`}
        onClick={(e) => { e.stopPropagation(); onSelect(provider.id) }}
      >
        {selected ? "✓ Selected" : "Select Provider"}
      </Button>
    </div>
  )
}
