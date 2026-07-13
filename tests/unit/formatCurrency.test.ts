import { describe, it, expect } from "vitest"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"

describe("formatCurrencyForCountry", () => {
  it("formats DE euro values using German locale by default", () => {
    expect(formatCurrencyForCountry(1900, "DE")).toBe("19,00 €")
  })

  it("allows overriding the locale to preserve dot decimal formatting", () => {
    expect(formatCurrencyForCountry(1900, "DE", "en-GB")).toBe("€19.00")
  })

  it("formats US dollar values with USD locale", () => {
    expect(formatCurrencyForCountry(1900, "US")).toBe("$19.00")
  })
})
