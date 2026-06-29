import { BRAND_CONTEXT } from "@/lib/marketing/products"
import type { AudienceFilter, CampaignType, EmailDraft, RecipientProfile } from "@/lib/marketing/types"

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash"

export class GeminiError extends Error {}

// Low-level call. Returns parsed JSON (responseMimeType=application/json) or raw text.
async function callGemini(prompt: string, json = true): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set")
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.95, // high → varied wording per call (anti-spam)
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  )
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new GeminiError(`Gemini ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new GeminiError("Gemini returned no content")
  return text
}

// Robustly extract a JSON object even if the model wraps it in ```fences``` or prose.
function parseJson<T>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}/)
  try {
    return JSON.parse(match ? match[0] : raw) as T
  } catch {
    throw new GeminiError("Gemini returned invalid JSON")
  }
}

const TYPE_GUIDANCE: Record<CampaignType, string> = {
  welcome:
    "A warm welcome. Thank them for joining, briefly explain what DORIXÉ offers, and highlight 2-3 services they might like. No hard sell — make them feel at home.",
  value:
    "Pure value, almost no selling: share genuinely useful eco home-care / cleaning tips. Build trust and goodwill. At most a soft mention of DORIXÉ.",
  soft_sell:
    "Gentle nudge: connect a real benefit to booking a cleaner. One friendly call-to-action. Helpful, not pushy.",
  hard_sell:
    "A clear, compelling offer with a strong (but classy) call-to-action to book now. Create momentum without being spammy.",
  custom: "Follow the admin brief precisely.",
}

const LANG_NAME: Record<string, string> = { de: "German", fr: "French", es: "Spanish", it: "Italian", nl: "Dutch", pl: "Polish", pt: "Portuguese", en: "English" }

export async function generateMarketingEmail(params: {
  type: CampaignType
  brief?: string
  recipient?: RecipientProfile
  locale?: string
}): Promise<EmailDraft> {
  const { type, brief, recipient, locale } = params
  const name = recipient?.firstName?.trim() || "there"
  const langRule = locale && locale !== "en" && LANG_NAME[locale]
    ? `\n- Write the ENTIRE email (subject + body) in ${LANG_NAME[locale]} — natural, native-quality.`
    : ""
  const prompt = `${BRAND_CONTEXT}

You are an expert email marketer for DORIXÉ. Write ONE unique, high-deliverability marketing email.

Email type: ${type}
Goal for this type: ${TYPE_GUIDANCE[type]}
${brief ? `Admin brief: ${brief}` : ""}
Recipient first name: ${name}
${recipient ? `Recipient context: role=${recipient.role ?? "customer"}, signed up ${recipient.signedUpDaysAgo ?? "?"} days ago, ${recipient.bookingCount ?? 0} bookings.` : ""}

Rules:${langRule}
- Personalize naturally (greet "${name}"). Reference REAL DORIXÉ services only.
- VARY the wording, structure, and phrasing so no two emails look the same (avoids spam filtering).
- Subject under 60 chars, compelling, NO spam triggers (no ALL CAPS, no "!!!", no "FREE MONEY", no excessive emojis).
- Keep it concise and scannable. Warm, premium, eco-conscious tone.
- Return clean inline-styled HTML for the body only — NO <html>/<head>/<body> tags, NO unsubscribe link (added separately).

Return strict JSON: {"subject": "...", "html": "..."}`

  const raw = await callGemini(prompt, true)
  const parsed = parseJson<Partial<EmailDraft>>(raw)
  if (!parsed.subject || !parsed.html) throw new GeminiError("Email draft missing subject/html")
  return { subject: parsed.subject, html: parsed.html }
}

export async function suggestSegment(goal: string): Promise<{ filter: AudienceFilter; rationale: string }> {
  const prompt = `${BRAND_CONTEXT}

You target a marketing email to the right users. Given the admin's goal, choose a SEGMENT FILTER.

Admin goal: ${goal}

Available filter fields (omit ones that don't apply):
- role: "customer" | "provider" | "all"
- onlyConsented: boolean (marketing-consented users only — recommended true)
- signedUpWithinDays: number (joined recently)
- signedUpMoreThanDays: number (dormant users)
- hasBooked: boolean (clients who have booked)
- noBookings: boolean (clients who never booked)
- limit: number (optional safety cap)

Return strict JSON: {"filter": { ... }, "rationale": "one short sentence"}`

  const raw = await callGemini(prompt, true)
  const parsed = parseJson<{ filter?: AudienceFilter; rationale?: string }>(raw)
  return { filter: parsed.filter ?? {}, rationale: parsed.rationale ?? "" }
}
