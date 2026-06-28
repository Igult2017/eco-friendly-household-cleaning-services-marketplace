# DORIXÉ — Pre-launch legal checklist (no-lawyer edition)

Your four legal pages are now LIVE and read as complete documents — no visible "to-complete" gaps.
Where a real company doesn't exist yet, they use honest **pre-launch wording** ("operated by its
individual founder; a registered company has not yet been formed; details published before launch").

This is what to do **before you take real customers or real money**, ordered by how much risk each
removes. **None of this is legal advice — get an attorney to review when you can afford one.**

## Before real launch (highest risk first)
1. **Identity in the Impressum — the #1 German risk.** A missing/false Impressum is the most common
   cheap "Abmahnung" (paid warning letter). Before you actually trade, register an entity OR operate
   as a named individual, and put the real **name + contact postal address** into
   `lib/legal/impressum.ts` (and the matching lines in `lib/legal/terms.ts` and `privacy.ts`), then
   redeploy.
2. **Don't re-add removed claims unless they are TRUE.** Background checks, insurance, "eco-certified",
   and per-booking carbon offsets are written conservatively now. Only state them if you can prove them.
3. **Set up the contact inboxes** the pages reference: legal@ / privacy@ / support@ / abuse@ dorixé.com
   (forwarding to your normal inbox is fine).
4. **Stay in pre-launch/test until 1–3 are done.** With ~0 real users your exposure today is low; it
   jumps the moment you take real bookings or payments.

## Later / when you can afford a lawyer
- One attorney review of all four pages (a couple of hours covers the big risks).
- Recurring-setup UI: show the auto-renewal disclosure + a pre-charge reminder (the API already
  requires recorded consent).
- Capture the EU 14-day "start early & waive withdrawal" checkbox at checkout for sub-14-day bookings.
- Wire a US "Do Not Sell/Share" opt-out + honour the GPC browser signal.

## Already handled — no action needed
- Unsubstantiated marketing claims removed across all 8 languages + llms.txt/site meta.
- Cookie/analytics consent is now actually enforced and withdrawable.
- Recurring auto-charge cannot happen without recorded consent.
- Comprehensive EU/US/global Terms, Privacy, Cookie, and Impressum are live, with ~80 details
  auto-filled from your own configuration + safe small-operator defaults.
- Full audit: `docs/legal/AUDIT-REPORT.md`. Extra pages to consider: `docs/legal/RECOMMENDED-PAGES.md`.
