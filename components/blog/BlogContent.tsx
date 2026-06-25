import { sanitizeBlogHtml } from "@/lib/security/sanitize"

// Renders admin-authored HTML from TipTap. The HTML is sanitised (allow-listed tags/attrs only;
// <script>, event handlers and javascript: URLs stripped) to prevent stored XSS — H1 fix.
export function BlogContent({ html }: { html: string }) {
  return (
    <div
      className="prose prose-slate max-w-none
        prose-headings:font-serif prose-headings:text-[#2B3441]
        prose-h2:text-2xl prose-h3:text-xl
        prose-p:text-[#2B3441]/80 prose-p:leading-relaxed
        prose-a:text-[#2D7A5F] prose-a:no-underline hover:prose-a:underline
        prose-img:rounded-xl prose-img:shadow-sm prose-img:w-full
        prose-blockquote:border-[#2D7A5F] prose-blockquote:text-[#6B7280]
        prose-code:bg-gray-100 prose-code:px-1.5 prose-code:rounded prose-code:text-sm
        [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-xl [&_iframe]:my-4"
      dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(html) }}
    />
  )
}
