import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { MapPin, Briefcase, Clock } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDistance } from "@/lib/utils/locale"

type NearbyJob = {
  id: string
  title: string
  budgetMin: number | null
  budgetMax: number | null
  desiredDate: string | null
  serviceAddress: { city?: string; country?: string } | null
  distanceMeters: number
  category: { name: string } | null
}

function BudgetLabel({
  min,
  max,
  budgetFlexibleLabel,
  fromLabel,
}: {
  min: number | null
  max: number | null
  budgetFlexibleLabel: string
  fromLabel: string
}) {
  if (!min && !max) return <span className="text-xs text-[#9CA3AF]">{budgetFlexibleLabel}</span>
  if (min && max) return <span className="text-xs font-medium text-[#2D7A5F]">{formatCurrency(min)} – {formatCurrency(max)}</span>
  return <span className="text-xs font-medium text-[#2D7A5F]">{fromLabel} {formatCurrency(min ?? max ?? 0)}</span>
}

export async function ProviderDashboardNearbyJobs({
  jobs,
  hasLocation,
  providerCountry,
}: {
  jobs: NearbyJob[]
  hasLocation: boolean
  providerCountry: string
}) {
  const t = await getTranslations("compProviderProviderDashboardNearbyJobs")
  if (!hasLocation) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <MapPin size={36} className="mx-auto text-[#9CA3AF] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">{t("setLocationTitle")}</p>
        <p className="text-sm text-[#6B7280] mb-4">
          {t("setLocationDescription")}
        </p>
        <Link href="/provider/profile">
          <Button size="sm" className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">
            {t("updateProfile")}
          </Button>
        </Link>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] p-6 text-center">
        <Briefcase size={36} className="mx-auto text-[#9CA3AF] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">{t("noJobsTitle")}</p>
        <p className="text-sm text-[#6B7280]">{t("noJobsDescription")}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <MapPin size={16} className="text-[#2D7A5F]" /> {t("jobsNearYou")}
          <span className="bg-[#D1F0E0] text-[#2D7A5F] text-xs font-semibold px-2 py-0.5 rounded-full">
            {t("openCount", { count: jobs.length })}
          </span>
        </h2>
        <Link href="/provider/jobs" className="text-xs text-[#2D7A5F] hover:underline">{t("seeAll")}</Link>
      </div>
      <div className="divide-y divide-[#F0F4F8]">
        {jobs.map((job) => {
          const city = job.serviceAddress?.city ?? "—"
          const country = job.serviceAddress?.country ?? providerCountry
          const distKm = (job.distanceMeters ?? 0) / 1000
          return (
            <div key={job.id} className="px-5 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#2B3441] line-clamp-1">{job.title}</p>
                <p className="text-xs text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                  <MapPin size={10} /> {city} · {formatDistance(distKm, country)}
                </p>
                {job.category && (
                  <span className="inline-block mt-1 text-xs bg-[#EDF5F0] text-[#2D7A5F] px-2 py-0.5 rounded-full">
                    {job.category.name}
                  </span>
                )}
                {job.desiredDate && (
                  <p className="text-xs text-[#9CA3AF] mt-1 flex items-center gap-1">
                    <Clock size={10} /> {t("desired", { date: job.desiredDate })}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <BudgetLabel
                  min={job.budgetMin}
                  max={job.budgetMax}
                  budgetFlexibleLabel={t("budgetFlexible")}
                  fromLabel={t("from")}
                />
                <Link href={`/provider/jobs?job=${job.id}`}>
                  <Button size="sm" variant="outline" className="border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#F4FAF6] text-xs h-7">
                    {t("bidNow")}
                  </Button>
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
