// Injects schema.org JSON-LD into the page. Server component — renders a single
// <script type="application/ld+json"> that Google and AI engines parse.
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline; no user HTML is interpolated.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
