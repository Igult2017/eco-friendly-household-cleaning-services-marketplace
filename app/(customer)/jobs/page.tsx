"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useUser } from "@clerk/nextjs"
import { usePusherChannel } from "@/hooks/usePusherChannel"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AcceptBidButton } from "@/components/bidding/AcceptBidButton"
import { CompleteBookingButton } from "@/components/bidding/CompleteBookingButton"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { formatDate, localTodayYmd } from "@/lib/utils/formatDate"
import { cn } from "@/lib/utils"
import { TIER_CLASS } from "@/lib/provider/reliability"
import { InlineQuickMessage } from "@/components/messaging/InlineQuickMessage"
import {
  Plus, Star, Clock, Leaf, Eye, ChevronDown, ChevronUp,
  MapPin, Timer, CalendarDays, MessageSquare, Briefcase, Loader2,
} from "lucide-react"

interface BidProvider {
  slug: string
  businessName: string
  bio: string | null
  averageRating: number | null
  totalReviews: number
  totalJobsCompleted: number
  profilePhotoUrl: string | null
  ecoLevel: string
  ecoScore: number
  city: string | null
  postalCode: string | null
  country: string
}

interface Bid {
  id: string
  status: string
  bookingId: string | null
  amount: number
  message: string | null
  estimatedDurationMinutes: number | null
  proposedDate: string | null
  proposedTimeStart: string | null
  createdAt: string
  provider: BidProvider | null
  bestMatch?: boolean
  reliabilityScore?: number
  reliabilityTier?: string
  distanceLabel?: string | null
}

interface Job {
  id: string
  title: string
  description: string
  status: string
  budgetMin: number | null
  budgetMax: number | null
  desiredDate: string | null
  serviceAddress: { line1: string; city: string; postalCode: string; country: string }
  ecoRequirements: string[]
  viewCount: number
  expiresAt: string
  createdAt: string
  category: { name: string } | null
  bids: Bid[]
}

const STATUS_COLOR: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  bidding: "bg-[#D1F0E0] text-[#2D7A5F]",
  assigned: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
}

const ECO_LABEL: Record<string, string> = {
  basic: "Basic",
  certified: "Certified",
  premium: "Premium",
  zero_impact: "Zero Impact",
}

const ECO_COLOR: Record<string, string> = {
  basic: "bg-[#D1F0E0] text-[#2D7A5F]",
  certified: "bg-[#4CB87A]/20 text-[#2D7A5F]",
  premium: "bg-[#2D7A5F]/20 text-[#235f49]",
  zero_impact: "bg-[#2B3441]/10 text-[#2B3441]",
}

function BidCard({ bid, jobId, jobStatus }: { bid: Bid; jobId: string; jobStatus: string }) {
  const t = useTranslations("customerJobsPage")
  const p = bid.provider
  const initials = p?.businessName?.slice(0, 2).toUpperCase() ?? "??"
  const location = [p?.city, p?.postalCode, p?.country].filter(Boolean).join(", ")
  const canAccept = bid.status === "pending" && ["open", "bidding"].includes(jobStatus)

  return (
    <div className={cn(
      "rounded-xl border-2 overflow-hidden transition-all",
      bid.status === "accepted" ? "border-[#2D7A5F] bg-[#F4FAF6]" :
      bid.status === "rejected" ? "border-[#E5EBF0] opacity-50" :
      "border-[#E5EBF0] bg-white hover:border-[#4CB87A]/40"
    )}>
      {/* Provider header */}
      <div className="p-4 flex items-start gap-4">
        {p?.profilePhotoUrl ? (
          <img
            src={p.profilePhotoUrl}
            alt={p.businessName}
            className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2 border-[#E5EBF0]"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#D1F0E0] flex items-center justify-center text-[#2D7A5F] font-bold text-base flex-shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              {bid.bestMatch && (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700" title={t("bestMatchWhy")}>
                  <Star size={9} className="fill-amber-500 text-amber-500" /> {t("bestMatch")}
                </span>
              )}
              <h3 className="font-semibold text-[#2B3441] text-sm">
                {p?.slug ? (
                  <Link href={`/providers/${p.slug}`} target="_blank" className="hover:text-[#2D7A5F] hover:underline transition-colors">
                    {p.businessName}
                  </Link>
                ) : (p?.businessName ?? t("unknownProvider"))}
              </h3>
              {location && (
                <p className="flex items-center gap-1 text-xs text-[#6B7280] mt-0.5">
                  <MapPin size={11} className="flex-shrink-0" />
                  {location}
                  {bid.distanceLabel && <span className="font-medium text-[#2D7A5F]"> · {t("distanceAway", { distance: bid.distanceLabel })}</span>}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              {/* Bid amounts are in the CLEANER's currency — a US cleaner's $ bid must not render as €. */}
              <p className="font-bold text-[#2D7A5F] text-lg leading-tight">{formatCurrencyForCountry(bid.amount, p?.country ?? "DE")}</p>
              <p className="text-xs text-[#9CA3AF]">{t("bidAmount")}</p>
              {bid.estimatedDurationMinutes ? (
                <p className="text-[11px] text-[#6B7280]">{t("impliedRate", { rate: formatCurrencyForCountry(Math.round((bid.amount * 60) / bid.estimatedDurationMinutes), p?.country ?? "DE", "en-GB") })}</p>
              ) : null}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {p?.averageRating != null && p.averageRating > 0 && (
              <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                {Number(p.averageRating).toFixed(1)}
                {p.totalReviews > 0 && <span className="text-[#9CA3AF]">({p.totalReviews})</span>}
              </span>
            )}
            {(p?.totalJobsCompleted ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                <Briefcase size={11} />
                {t("jobsDone", { count: p!.totalJobsCompleted })}
              </span>
            )}
            {p?.ecoLevel && (
              <Badge className={cn("text-xs px-1.5 py-0 h-5", ECO_COLOR[p.ecoLevel])}>
                <Leaf size={10} className="mr-0.5" />
                {ECO_LABEL[p.ecoLevel] ? t(`ecoLevel_${p.ecoLevel}` as Parameters<typeof t>[0]) : p.ecoLevel}
              </Badge>
            )}
            {(p?.ecoScore ?? 0) > 0 && (
              <span className="text-xs text-[#2D7A5F] font-medium">{t("ecoScore", { score: p!.ecoScore })}</span>
            )}
            {bid.reliabilityTier && bid.reliabilityTier !== "new" && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", TIER_CLASS[bid.reliabilityTier as keyof typeof TIER_CLASS] ?? "bg-gray-100 text-gray-600")}>
                {t(`tier_${bid.reliabilityTier}` as Parameters<typeof t>[0])} · {bid.reliabilityScore}/100
              </span>
            )}
          </div>

          {/* Bio */}
          {p?.bio && (
            <p className="text-xs text-[#6B7280] mt-2 line-clamp-2">{p.bio}</p>
          )}
        </div>
      </div>

      {/* Bid details */}
      <div className="px-4 pb-4 border-t border-[#F4FAF6] pt-3 space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7280]">
          {bid.estimatedDurationMinutes && (
            <span className="flex items-center gap-1">
              <Timer size={11} />
              {t("estimatedDuration", {
                duration: bid.estimatedDurationMinutes >= 60
                  ? `${Math.floor(bid.estimatedDurationMinutes / 60)}h${bid.estimatedDurationMinutes % 60 > 0 ? ` ${bid.estimatedDurationMinutes % 60}m` : ""}`
                  : `${bid.estimatedDurationMinutes}m`,
              })}
            </span>
          )}
          {bid.proposedDate && (
            <span className="flex items-center gap-1">
              <CalendarDays size={11} />
              {bid.proposedTimeStart
                ? t("proposedDateTime", { date: formatDate(bid.proposedDate), time: bid.proposedTimeStart.slice(0, 5) })
                : formatDate(bid.proposedDate)}
            </span>
          )}
          <span className="flex items-center gap-1 text-[#9CA3AF]">
            <Clock size={11} /> {t("submitted", { date: formatDate(bid.createdAt) })}
          </span>
        </div>

        {/* Cover letter — the cleaner's proposal to the client. Rendered even when absent so the
            client sees the difference between "wrote nothing" and a real pitch. */}
        <div className="bg-[#F4FAF6] rounded-lg p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
            <MessageSquare size={11} /> {t("coverLetter")}
          </p>
          {bid.message ? (
            <p className="text-xs text-[#2B3441] leading-relaxed whitespace-pre-wrap">{bid.message}</p>
          ) : (
            <p className="text-xs italic text-[#9CA3AF]">{t("noCoverLetter")}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          {bid.status === "accepted" && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#2D7A5F]">{t("bidAccepted")}</span>
              {/* Resume path — the accept-time redirect state is lost if the client navigated away. */}
              <CompleteBookingButton jobId={jobId} bookingId={bid.bookingId} />
            </div>
          )}
          {bid.status === "rejected" && (
            <span className="text-xs text-[#9CA3AF]">{t("bidDeclined")}</span>
          )}
          {canAccept && (
            <div className="ml-auto flex items-center gap-2">
              {p?.slug && (
                <Link
                  href={`/providers/${p.slug}`}
                  target="_blank"
                  className="rounded-lg border border-[#E5EBF0] px-3 py-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:border-[#2D7A5F] hover:text-[#2D7A5F]"
                >
                  {t("viewProfile")}
                </Link>
              )}
              <AcceptBidButton jobId={jobId} bidId={bid.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CustomerJobsPage() {
  const t = useTranslations("customerJobsPage")
  const { user } = useUser()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function load() {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // LIVE bids: the bid API pushes "new-bid" on the client's private channel — refetch instantly so a
  // fresh bid appears without waiting for the notification bell's poll.
  usePusherChannel(user ? `private-customer-${user.id}` : "", { "new-bid": () => load() })

  function toggleBids(jobId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(jobId) ? next.delete(jobId) : next.add(jobId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4FAF6] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#2D7A5F]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{t("pageTitle")}</h1>
            <p className="text-[#6B7280] text-sm mt-1">{t("pageSubtitle")}</p>
          </div>
          <Link href="/post-job">
            <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white gap-2">
              <Plus size={16} /> {t("postJob")}
            </Button>
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#E5EBF0]">
            <Clock size={48} className="mx-auto text-[#9CA3AF] mb-4" />
            <h2 className="font-serif text-xl font-bold text-[#2B3441] mb-2">{t("emptyTitle")}</h2>
            <p className="text-[#6B7280] mb-6">{t("emptyDescription")}</p>
            <Link href="/post-job">
              <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">{t("postJob")}</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const bidCount = job.bids.length
              const isOpen = expanded.has(job.id)
              const hasBids = bidCount > 0

              return (
                <div key={job.id} className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm overflow-hidden">
                  {/* Job summary card */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-semibold text-[#2B3441]">{job.title}</h2>
                          <Badge className={cn("text-xs", STATUS_COLOR[job.status] ?? "bg-gray-100 text-gray-600")}>
                            {STATUS_COLOR[job.status]
                              ? t(`status_${job.status}` as Parameters<typeof t>[0])
                              : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                          </Badge>
                        </div>
                        {job.category && (
                          <p className="text-xs text-[#6B7280] mt-0.5">{job.category.name}</p>
                        )}
                        <p className="text-xs text-[#9CA3AF] mt-1">
                          <MapPin size={11} className="inline mr-0.5" />
                          {job.serviceAddress.city}, {job.serviceAddress.postalCode}
                          {" · "}{t("posted", { date: formatDate(job.createdAt) })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {job.budgetMin && job.budgetMax && (
                          <p className="text-sm font-bold text-[#2D7A5F]">
                            {job.budgetMin === job.budgetMax
                              ? formatCurrencyForCountry(job.budgetMin, job.serviceAddress.country, "en-GB")
                              : <>{formatCurrencyForCountry(job.budgetMin, job.serviceAddress.country, "en-GB")} – {formatCurrencyForCountry(job.budgetMax, job.serviceAddress.country, "en-GB")}</>}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stats + expand toggle */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                        <span className="flex items-center gap-1.5">
                          <Eye size={14} />
                          <span><strong className="text-[#2B3441]">{job.viewCount}</strong> {t("views", { count: job.viewCount })}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MessageSquare size={14} />
                          <span><strong className="text-[#2B3441]">{bidCount}</strong> {t("bids", { count: bidCount })}</span>
                        </span>
                        {job.desiredDate && (
                          <span className="flex items-center gap-1 text-xs">
                            <CalendarDays size={13} />
                            {t("wanted", { date: formatDate(job.desiredDate) })}
                          </span>
                        )}
                      </div>

                      {hasBids && (
                        <button
                          onClick={() => toggleBids(job.id)}
                          className="flex items-center gap-1.5 text-sm font-medium text-[#2D7A5F] hover:text-[#235f49] transition-colors"
                        >
                          {isOpen ? (
                            <><ChevronUp size={16} /> {t("hideBids")}</>
                          ) : (
                            <><ChevronDown size={16} /> {t("viewBids", { count: bidCount })}</>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Past desired date on a still-open job → label it OVERDUE with the day count. */}
                    {(() => {
                      const overdueDays =
                        ["open", "bidding"].includes(job.status) && job.desiredDate && job.desiredDate < localTodayYmd()
                          ? Math.max(1, Math.floor((Date.now() - new Date(job.desiredDate + "T12:00:00").getTime()) / 86_400_000))
                          : 0
                      return overdueDays > 0 ? (
                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                          {t("overdueBy", { days: overdueDays })}
                        </p>
                      ) : null
                    })()}

                    {["open", "bidding"].includes(job.status) && (
                      <div className="mt-3 flex items-center gap-4">
                        {!hasBids && <p className="text-xs text-[#9CA3AF]">{t("waitingForBidsShort")}</p>}
                        <Link href={`/jobs/${job.id}/edit`} className="text-xs font-medium text-[#2D7A5F] hover:underline">
                          {t("editJob")}
                        </Link>
                        {/* Deletable only while nobody has bid — the API enforces it too. */}
                        {!hasBids && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(t("deleteConfirm"))) return
                              const r = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" })
                              if (r.ok) load()
                              else alert((await r.json().catch(() => ({}))).error ?? t("deleteFailed"))
                            }}
                            className="text-xs font-medium text-red-500 hover:underline"
                          >
                            {t("deleteJob")}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Bid accepted → quick message expands right here; full chat one link away. */}
                    {job.status === "assigned" && (
                      <div className="mt-3">
                        <InlineQuickMessage
                          endpoint={`/api/jobs/${job.id}/messages`}
                          chatHref={`/jobs/${job.id}/messages`}
                          label={t("messageCleaner")}
                          variant="primary"
                        />
                      </div>
                    )}
                  </div>

                  {/* Expandable bids panel */}
                  {isOpen && hasBids && (
                    <div className="border-t border-[#F4FAF6] bg-[#F4FAF6] p-4 space-y-3">
                      <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">
                        {t("bidsReceived", { count: bidCount })}
                      </p>
                      {job.bids.map((bid) => (
                        <BidCard key={bid.id} bid={bid} jobId={job.id} jobStatus={job.status} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
