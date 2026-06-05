import Link from "next/link"
import Image from "next/image"

const LINKS = {
  Product: [
    { label: "Browse cleaners", href: "/browse" },
    { label: "Post a job", href: "/post-job" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Pricing", href: "/pricing" },
  ],
  Company: [
    { label: "About us", href: "/about" },
    { label: "Sustainability", href: "/sustainability" },
    { label: "Become a cleaner", href: "/become-a-cleaner" },
    { label: "Blog", href: "/blog" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "Legal Notice", href: "/legal" },
  ],
}

export function Footer() {
  return (
    <footer className="bg-[#2B3441] text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <Image src="/logo.png" alt="DORIX" width={100} height={36} className="brightness-0 invert" />
            </div>
            <p className="text-sm leading-relaxed text-white/50 max-w-[200px]">
              Clean home. Green future.<br />
              Trusted eco-friendly cleaners across Europe.
            </p>
          </div>
          {Object.entries(LINKS).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-white text-sm font-semibold mb-4">{section}</h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
          <p>© 2026 DORIX. All rights reserved.</p>
          <p>Registered in the EU · GDPR Compliant · Powered by Stripe</p>
        </div>
      </div>
    </footer>
  )
}
