// Instant navigation feedback for admin pages (see app/(customer)/loading.tsx).
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-9 w-64 rounded-lg bg-gray-200/80 mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 border border-gray-100" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-gray-100 border border-gray-100" />
    </div>
  )
}
