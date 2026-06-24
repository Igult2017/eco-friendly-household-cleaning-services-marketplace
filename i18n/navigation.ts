import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

// Locale-aware navigation for PUBLIC pages. Drop-in replacements for next/link + next/navigation
// that automatically keep the active locale prefix in hrefs and router pushes.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
