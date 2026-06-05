import { type Page } from "@playwright/test"

export const TEST_CUSTOMER = {
  email: process.env.TEST_CUSTOMER_EMAIL ?? "customer@dorix-test.eu",
  password: process.env.TEST_CUSTOMER_PASSWORD ?? "TestPassword123!",
}

export const TEST_PROVIDER = {
  email: process.env.TEST_PROVIDER_EMAIL ?? "provider@dorix-test.eu",
  password: process.env.TEST_PROVIDER_PASSWORD ?? "TestPassword123!",
}

export const TEST_ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL ?? "admin@dorix-test.eu",
  password: process.env.TEST_ADMIN_PASSWORD ?? "TestPassword123!",
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /sign in|continue/i }).click()
  await page.waitForURL(/dashboard|onboarding/, { timeout: 15_000 })
}

export async function signOut(page: Page) {
  await page.goto("/")
  const userButton = page.locator("[data-clerk-user-button]").first()
  if (await userButton.isVisible()) {
    await userButton.click()
    await page.getByRole("menuitem", { name: /sign out/i }).click()
    await page.waitForURL("/", { timeout: 10_000 })
  }
}
