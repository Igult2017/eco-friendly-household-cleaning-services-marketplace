import sanitizeHtml from "sanitize-html"

// Sanitises admin-authored blog HTML (from the TipTap editor) before it is stored and rendered.
// Strips <script>, event handlers (onerror/onclick/…), javascript: URLs, and any tag/attribute
// outside the TipTap allow-list — closing the stored-XSS hole (H1) while keeping every formatting
// feature the editor produces (headings, lists, links, images, code, YouTube/Vimeo embeds, tables).
export function sanitizeBlogHtml(dirty: string | null | undefined): string {
  if (!dirty) return ""
  return sanitizeHtml(dirty, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "a", "ul", "ol", "li", "blockquote",
      "code", "pre", "strong", "b", "em", "i", "u", "s", "mark",
      "br", "hr", "img", "iframe", "span", "div",
      "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    // Embeds are restricted to known video hosts; everything else is dropped.
    allowedIframeHostnames: [
      "www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com",
    ],
    // Force safe link behaviour (no tab-nabbing, no referrer leakage to arbitrary hosts).
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
    },
  })
}
