import type { SVGProps } from "react"

// Official brand marks, not lookalikes — the previous versions were hand-drawn in lucide's outline
// style and read as generic shapes rather than the companies they stand for (the TikTok one was an
// admitted musical-note approximation). Artwork is the Font Awesome 6 Brands set, CC BY 4.0
// (https://fontawesome.com/license/free) — all four taken from the one collection so they share a
// design language. Each brand mark remains the trademark of its owner and is used here only to link
// to DORIXÉ's own profiles on those services.
//
// Paths are inlined rather than pulled from an icon package on purpose: the react wrappers for both
// Font Awesome and Simple Icons render a React context consumer, which cannot run inside a Server
// Component, and Footer.tsx is server-rendered. Inlining also keeps four static icons out of the
// browser's JavaScript entirely.
//
// Brand marks are solid shapes filled with the current text colour, so unlike the outline icons
// they replace there is no stroke. Each keeps its own viewBox from the source set; they scale to a
// common height, which is what makes a row of different-width logos look aligned.
function BrandIcon({ viewBox, d, ...props }: SVGProps<SVGSVGElement> & { viewBox: string; d: string }) {
  return (
    <svg viewBox={viewBox} fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d={d} />
    </svg>
  )
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BrandIcon
      {...props}
      viewBox="0 0 320 512"
      d="M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z"
    />
  )
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BrandIcon
      {...props}
      viewBox="0 0 448 512"
      d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"
    />
  )
}

function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BrandIcon
      {...props}
      viewBox="0 0 448 512"
      d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"
    />
  )
}

function TiktokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BrandIcon
      {...props}
      viewBox="0 0 448 512"
      d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"
    />
  )
}

// hrefs are placeholders until real profile URLs are provided — swap them here, nowhere else.
export const SOCIAL_LINKS = [
  { key: "facebook", label: "Facebook", href: "#", Icon: FacebookIcon },
  { key: "instagram", label: "Instagram", href: "#", Icon: InstagramIcon },
  { key: "linkedin", label: "LinkedIn", href: "#", Icon: LinkedinIcon },
  { key: "tiktok", label: "TikTok", href: "#", Icon: TiktokIcon },
] as const
