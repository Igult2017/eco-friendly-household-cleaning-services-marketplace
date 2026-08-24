import type { SVGProps } from "react"

// Matches lucide's own SVG conventions (24x24, stroke, round caps) so these sit visually
// consistent with every other icon on the site, since lucide has no brand/social logos built in.
function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </IconBase>
  )
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </IconBase>
  )
}

function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </IconBase>
  )
}

// TikTok postdates this stroke-icon style, so there's no long-standing outline convention for it
// (unlike the other three) — this is a simplified musical-note approximation, not the official
// trademarked logomark, kept in the same visual language as the icons above.
function TiktokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="8" cy="18" r="3" />
      <path d="M11 18V4" />
      <path d="M11 8a5 5 0 0 0 5 5V9a3 3 0 0 1-3-3" />
    </IconBase>
  )
}

// hrefs are placeholders until real profile URLs are provided — swap them here, nowhere else.
export const SOCIAL_LINKS = [
  { key: "facebook", label: "Facebook", href: "#", Icon: FacebookIcon },
  { key: "instagram", label: "Instagram", href: "#", Icon: InstagramIcon },
  { key: "linkedin", label: "LinkedIn", href: "#", Icon: LinkedinIcon },
  { key: "tiktok", label: "TikTok", href: "#", Icon: TiktokIcon },
] as const
