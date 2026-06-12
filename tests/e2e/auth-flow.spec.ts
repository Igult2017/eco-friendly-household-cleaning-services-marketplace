import { test, expect } from "@playwright/test"

test.describe("Auth flow", () => {
  test("sign-in page renders", async ({ page }) => {
    await page.goto("/sign-in")
    await expect(page.locator("body")).toBeVisible()
    // Clerk renders an iframe-based sign-in — look for any input field
    const emailInput = page.locator("input[type='email'], input[name='identifier'], input[placeholder*='email' i]").first()
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
  })

  test("sign-up page renders", async ({ page }) => {
    await page.goto("/sign-up")
    await expect(page.locator("body")).toBeVisible()
    const input = page.locator("input[type='email'], input[name='emailAddress'], input[placeholder*='email' i]").first()
    await expect(input).toBeVisible({ timeout: 15_000 })
  })

  test("unauthenticated user redirected from dashboard", async ({ page }) => {
    await page.goto("/dashboard")
    // Should redirect to sign-in
    await page.waitForURL(/sign-in|sign-up/, { timeout: 10_000 })
    expect(page.url()).toMatch(/sign-in|sign-up/)
  })

  test("unauthenticated user redirected from admin", async ({ page }) => {
    await page.goto("/admin/dashboard")
    await page.waitForURL(/sign-in|sign-up|\//, { timeout: 10_000 })
    expect(page.url()).not.toContain("/admin/dashboard")
  })

  test("unauthenticated user redirected from provider dashboard", async ({ page }) => {
    await page.goto("/provider/dashboard")
    await page.waitForURL(/sign-in|sign-up/, { timeout: 10_000 })
    expect(page.url()).toMatch(/sign-in|sign-up/)
  })

  test("public pages load without auth", async ({ page }) => {
    for (const path of ["/", "/browse", "/affiliate", "/pricing", "/become-a-cleaner", "/how-it-works"]) {
      await page.goto(path)
      await expect(page.locator("body")).toBeVisible()
      // Must not be a redirect to sign-in
      expect(page.url()).not.toMatch(/sign-in/)
    }
  })

  test("affiliate page shows sign-up CTA when logged out", async ({ page }) => {
    await page.goto("/affiliate")
    const cta = page.getByRole("link", { name: /get your link free|sign up/i }).first()
    await expect(cta).toBeVisible({ timeout: 10_000 })
    const href = await cta.getAttribute("href")
    expect(href).toMatch(/sign-up|sign-in/)
  })

  test("pricing page renders both pricing cards", async ({ page }) => {
    await page.goto("/pricing")
    await expect(page.getByRole("heading", { name: /for customers/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("heading", { name: /for cleaners/i })).toBeVisible()
    // Commission pct visible
    await expect(page.getByText("15%")).toBeVisible()
    await expect(page.getByText("€0")).toBeVisible()
  })
})
