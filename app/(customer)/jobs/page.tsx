import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { jobPosts, bids } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"
import { Plus, Star, Clock, CheckCircle2, Leaf } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_COLOR: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  bidding: "bg-[#D1F0E0] text-[#2D7A5F]",
  assigned: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
}

const ECO_BADGE: Record<string, string> = {
  basic: "bg-[#D1F0E0] text-[#2D7A5F]",
  certified: "bg-[#4CB87A]/20 text-[#2D7A5F]",
  premium: "bg-[#2D7A5F]/20 text-[#235f49]",
  zero_impact: "bg-[#2B3441]/10 text-[#2B3441]",
}

export default async function CustomerJobsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const jobs = await db.query.jobPosts.findMany({
    where: (jp) => eq(jp.customerId, userId),
    with: {
      category: { columns: { name: true } },
      bids: {
        with: { provider: { columns: { businessName: true, averageRating: true, totalReviews: true, profilePhotoUrl: true, ecoLevel: true, city: true } } },
        orderBy: [desc(bids.amount)],
      },
    },
    orderBy: [desc(jobPosts.createdAt)],
  })

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">My Job Posts</h1>
            <p className="text-[#6B7280] text-sm mt-1">Track bids from eco-cleaners</p>
          </div>
          <Link href="/post-job">
            <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white gap-2"><Plus size={16} /> Post a Job</Button>
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#E5EBF0]">
            <Clock size={48} className="mx-auto text-[#9CA3AF] mb-4" />
            <h2 className="font-serif text-xl font-bold text-[#2B3441] mb-2">No jobs posted yet</h2>
            <p className="text-[#6B7280] mb-6">Post a job and let cleaners compete for your business</p>
            <Link href="/post-job"><Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">Post a Job</Button></Link>
          </div>
        ) : (
          <div className="space-y-6">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#F4FAF6]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-[#2B3441]">{job.title}</h2>
                      <p className="text-xs text-[#9CA3AF] mt-1">{formatDate(job.createdAt)} · {job.serviceAddress.city}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge className={cn("text-xs", STATUS_COLOR[job.status] ?? "bg-gray-100 text-gray-600")}>{job.status.charAt(0).toUpperCase() + job.status.slice(1)}</Badge>
                      {job.budgetMin && job.budgetMax && (
                        <p className="text-xs font-medium text-[#2D7A5F]">{formatCurrency(job.budgetMin)} – {formatCurrency(job.budgetMax)}</p>
                      )}
                    </div>
                  </div>
                </div>

                {job.bids.length > 0 && (
                  <div className="p-5">
                    <p className="text-xs font-semibold text-[#6B7280] mb-3">{job.bids.length} bid{job.bids.length !== 1 ? "s" : ""} received</p>
                    <div className="space-y-3">
                      {job.bids.map((bid) => (
                        <div key={bid.id} className={cn("flex items-center justify-between gap-3 p-3 rounded-xl border-2", bid.status === "accepted" ? "border-[#2D7A5F] bg-[#F4FAF6]" : bid.status === "rejected" ? "border-[#E5EBF0] opacity-50" : "border-[#E5EBF0]")}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#D1F0E0] flex items-center justify-center text-[#2D7A5F] font-bold text-sm flex-shrink-0">
                              {bid.provider?.businessName?.[0] ?? "?"}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-[#2B3441]">{bid.provider?.businessName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {bid.provider?.averageRating && (
                                  <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                                    <Star size={11} className="fill-amber-400 text-amber-400" />
                                    {Number(bid.provider.averageRating).toFixed(1)}
                                  </span>
                                )}
                                <Badge className={cn("text-xs px-1.5 py-0", ECO_BADGE[bid.provider?.ecoLevel ?? "basic"])}>
                                  <Leaf size={10} className="mr-0.5" />{bid.provider?.ecoLevel?.replace("_", " ")}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-[#2D7A5F]">{formatCurrency(bid.amount)}</p>
                            {bid.status === "pending" && ["open", "bidding"].includes(job.status) && (
                              <form action={`/api/jobs/${job.id}/bids/${bid.id}/accept`} method="POST">
                                <Button size="sm" className="mt-1 h-7 text-xs bg-[#2D7A5F] hover:bg-[#235f49] text-white">Accept</Button>
                              </form>
                            )}
                            {bid.status === "accepted" && <p className="text-xs text-[#2D7A5F] font-semibold mt-1">✓ Accepted</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {job.bids.length === 0 && (
                  <div className="px-5 py-4 text-sm text-[#9CA3AF]">Waiting for bids — expires {formatDate(job.expiresAt)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
