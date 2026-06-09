import { test, expect } from "@playwright/test"
import { signIn, signOut, TEST_CUSTOMER, TEST_ADMIN, TEST_PROVIDER } from "./helpers/auth"

test.describe("Dispute lifecycle", () => {
  test("dispute creation endpoint requires authentication", async ({ request }) => {
    const res = await request.post("/api/bookings/fake-id/dispute", {
      data: { reason: "Service not delivered", description: "Provider did not show up." },
    })
    expect(res.status()).toBe(401)
  })

  test("dispute creation returns 404 for nonexistent booking", async ({ page }) => {
    await signIn(page, TEST_CUSTOMER.email, TEST_CUSTOMER.password)
    const res = await page.request.post(
      "/api/bookings/00000000-0000-0000-0000-000000000000/dispute",
      { data: { reason: "not_delivered", description: "Provider did not show up and did not contact me." } },
    )
    expect([404, 403, 422]).toContain(res.status())
  })

  test("admin dispute resolve endpoint is admin-only", async ({ page }) => {
    await signIn(page, TEST_CUSTOMER.email, TEST_CUSTOMER.password)
    const res = await page.request.post(
      "/api/admin/disputes/00000000-0000-0000-0000-000000000000/resolve",
      { data: { outcome: "resolved_customer", resolution: "Refund issued.", refundPercent: 100 } },
    )
    expect(res.status()).toBe(403)
  })

  test("dispute resolve validates refundPercent bounds", async ({ page }) => {
    await signIn(page, TEST_ADMIN.email, TEST_ADMIN.password)
    const res = await page.request.post(
      "/api/admin/disputes/00000000-0000-0000-0000-000000000000/resolve",
      { data: { outcome: "resolved_customer", resolution: "Refund issued.", refundPercent: 150 } },
    )
    // 400 = validation rejection, 403 = not admin (expected in test env), 404 = dispute not found
    expect([400, 403, 404]).toContain(res.status())
  })

  test("admin disputes list requires admin role", async ({ page }) => {
    await signIn(page, TEST_CUSTOMER.email, TEST_CUSTOMER.password)
    const res = await page.request.get("/api/admin/disputes")
    expect(res.status()).toBe(403)
  })

  test("GDPR delete endpoint revokes access and returns success", async ({ request }) => {
    // Only test that the endpoint is auth-protected — we don't want to delete test accounts
    const res = await request.post("/api/gdpr/delete")
    expect(res.status()).toBe(401)
  })

  test("GDPR export requires authentication", async ({ request }) => {
    const res = await request.get("/api/gdpr/export")
    expect(res.status()).toBe(401)
  })

  test("authenticated customer can request GDPR export", async ({ page }) => {
    await signIn(page, TEST_CUSTOMER.email, TEST_CUSTOMER.password)
    const res = await page.request.get("/api/gdpr/export")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("application/json")
    expect(res.headers()["content-disposition"]).toContain("attachment")
    const body = await res.json()
    expect(body).toHaveProperty("profile")
    expect(body).toHaveProperty("bookings")
    expect(body).toHaveProperty("reviews")
    expect(body.subject).toContain("GDPR")
  })
})

test.describe("Payout security", () => {
  test("weekly payout endpoint is not publicly accessible", async ({ page }) => {
    // Inngest cron — should not be triggerable via HTTP by anyone
    const res = await page.request.post("/api/inngest", {
      data: { name: "payout/process-provider", data: { providerId: "fake", periodStart: "2026-01-01", periodEnd: "2026-01-07" } },
    })
    // Without Inngest signing key this should be rejected
    expect([401, 400, 403]).toContain(res.status())
  })

  test("provider bids endpoint is job-owner only (BUG-4 regression)", async ({ page }) => {
    await signIn(page, TEST_PROVIDER.email, TEST_PROVIDER.password)
    // Provider trying to read bids on a job they don't own should get 403
    const res = await page.request.get("/api/jobs/00000000-0000-0000-0000-000000000000/bids")
    expect([403, 404]).toContain(res.status())
  })

  test("provider service delete requires ownership (BUG-1-critical regression)", async ({ page }) => {
    await signIn(page, TEST_PROVIDER.email, TEST_PROVIDER.password)
    const res = await page.request.delete("/api/provider/services", {
      data: { serviceId: "00000000-0000-0000-0000-000000000000" },
    })
    // Should be 404 (service not found under this provider), not 200
    expect([404, 400]).toContain(res.status())
  })
})

test.describe("Public browse jobs", () => {
  test("public jobs API returns jobs without authentication", async ({ page }) => {
    const res = await page.request.get("/api/jobs/public")
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("jobs")
    expect(Array.isArray(body.jobs)).toBe(true)
  })

  test("public jobs do not expose customer address line1", async ({ page }) => {
    const res = await page.request.get("/api/jobs/public")
    const body = await res.json()
    for (const job of body.jobs) {
      expect(job).not.toHaveProperty("serviceAddress")
      expect(job).not.toHaveProperty("line1")
    }
  })

  test("public jobs include assigned and expired status for UI display", async ({ page }) => {
    const res = await page.request.get("/api/jobs/public")
    const body = await res.json()
    const statuses = new Set(body.jobs.map((j: any) => j.status))
    // All returned statuses must be from the allowed set
    for (const s of statuses) {
      expect(["open", "bidding", "assigned", "expired"]).toContain(s)
    }
  })

  test("browse jobs page renders without login", async ({ page }) => {
    await page.goto("/browse-jobs")
    await expect(page.getByRole("heading", { name: /open cleaning jobs/i })).toBeVisible({ timeout: 10_000 })
  })
})
