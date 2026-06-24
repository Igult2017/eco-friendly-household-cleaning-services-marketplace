// Instant navigation feedback for provider pages (see app/(customer)/loading.tsx).
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-9 w-56 rounded-lg bg-gray-200/80 mb-2" />
      <div className="h-4 w-72 rounded bg-gray-100 mb-8" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-gray-100 border border-gray-100" />
        ))}
      </div>
    </div>
  )
}
