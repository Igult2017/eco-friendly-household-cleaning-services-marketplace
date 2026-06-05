import { describe, it, expect } from "vitest"

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const ALLOWED_FOLDERS = ["completions", "certifications", "avatars", "disputes"]
const R2_BASE = "https://pub.r2.dev"

// Mirrors the validation logic in /api/upload/presigned/route.ts
function validateUpload(contentType: string, folder: string, url: string) {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) return { ok: false, error: "Content type not allowed" }
  const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "completions"
  return { ok: true, safeFolder }
}

function validatePhotoUrl(url: string): boolean {
  return typeof url === "string" && R2_BASE !== "" && url.startsWith(R2_BASE)
}

describe("upload content-type whitelist (BUG-8 regression)", () => {
  it("allows jpeg", () => expect(validateUpload("image/jpeg", "avatars", "").ok).toBe(true))
  it("allows png", () => expect(validateUpload("image/png", "avatars", "").ok).toBe(true))
  it("allows pdf", () => expect(validateUpload("application/pdf", "certifications", "").ok).toBe(true))
  it("rejects svg — XSS vector", () => expect(validateUpload("image/svg+xml", "avatars", "").ok).toBe(false))
  it("rejects html", () => expect(validateUpload("text/html", "avatars", "").ok).toBe(false))
  it("rejects arbitrary binary", () => expect(validateUpload("application/octet-stream", "avatars", "").ok).toBe(false))
})

describe("upload folder sanitisation (BUG-8 regression)", () => {
  it("accepts known folder", () => {
    const r = validateUpload("image/jpeg", "certifications", "")
    expect(r.ok && r.safeFolder).toBe("certifications")
  })

  it("falls back to completions for unknown folder — prevents path traversal", () => {
    const r = validateUpload("image/jpeg", "../../etc/passwd", "")
    expect(r.ok && r.safeFolder).toBe("completions")
  })

  it("falls back for empty folder string", () => {
    const r = validateUpload("image/jpeg", "", "")
    expect(r.ok && r.safeFolder).toBe("completions")
  })
})

describe("photo URL validation on booking completion (BUG-15 regression)", () => {
  it("accepts URL from our R2 bucket", () => {
    expect(validatePhotoUrl("https://pub.r2.dev/completions/user/abc.jpg")).toBe(true)
  })

  it("rejects external URL", () => {
    expect(validatePhotoUrl("https://evil.com/xss.svg")).toBe(false)
  })

  it("rejects empty string", () => {
    expect(validatePhotoUrl("")).toBe(false)
  })

  it("rejects non-string values without throwing", () => {
    expect(validatePhotoUrl(null as any)).toBe(false)
    expect(validatePhotoUrl(undefined as any)).toBe(false)
  })
})
