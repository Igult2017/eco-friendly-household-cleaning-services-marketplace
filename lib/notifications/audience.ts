// Which role view a notification belongs to, derived from its link — DORIXÉ already treats
// everything under /provider/ as cleaner-only (see middleware.ts's isProviderRoute matcher), so
// that same, already-authoritative convention is reused here instead of inventing a second
// classification scheme (a per-type lookup would be unreliable: several notification types are
// sent to either side depending on context, e.g. bid_accepted goes to the provider who won a bid
// AND is reused for other directions via metadata.variant — the link, set per-instance at
// creation, is the one signal that's always correct for that specific notification).
export function getNotificationAudience(link: string | null): "customer" | "provider" {
  return link?.startsWith("/provider/") ? "provider" : "customer"
}
