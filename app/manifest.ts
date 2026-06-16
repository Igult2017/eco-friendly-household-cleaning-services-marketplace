import type { MetadataRoute } from "next"
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Eco-friendly cleaning marketplace`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#F4FAF6",
    theme_color: "#2D7A5F",
    icons: [
      { src: "/logo.png", sizes: "any", type: "image/png" },
    ],
  }
}
