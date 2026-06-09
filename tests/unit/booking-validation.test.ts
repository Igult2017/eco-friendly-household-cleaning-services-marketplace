import { describe, it, expect } from "vitest"
import { createBookingSchema, paymentIntentSchema } from "@/lib/validations/booking"

const baseAddress = { line1: "Musterstraße 1", city: "Berlin", postalCode: "10115", country: "DE" }

describe("createBookingSchema", () => {
  const valid = {
    providerId: crypto.randomUUID(),
    serviceId: crypto.randomUUID(),
    paymentIntentId: "pi_test_123",
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    durationMinutes: 120,
    serviceAddress: baseAddress,
  }

  it("accepts a valid booking payload", () => {
    expect(createBookingSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects missing providerId", () => {
    const r = createBookingSchema.safeParse({ ...valid, providerId: undefined })
    expect(r.success).toBe(false)
  })

  it("rejects negative carbon offset", () => {
    const r = createBookingSchema.safeParse({ ...valid, carbonOffsetCents: -1 })
    expect(r.success).toBe(false)
  })

  it("rejects carbon offset above 500 cents", () => {
    const r = createBookingSchema.safeParse({ ...valid, carbonOffsetCents: 501 })
    expect(r.success).toBe(false)
  })

  it("accepts carbon offset of exactly 200 cents", () => {
    const r = createBookingSchema.safeParse({ ...valid, carbonOffsetCents: 200 })
    expect(r.success).toBe(true)
  })

  it("rejects missing service address", () => {
    const r = createBookingSchema.safeParse({ ...valid, serviceAddress: undefined })
    expect(r.success).toBe(false)
  })
})

describe("paymentIntentSchema", () => {
  const valid = {
    providerId: crypto.randomUUID(),
    serviceId: crypto.randomUUID(),
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    durationMinutes: 60,
    serviceAddress: baseAddress,
  }

  it("accepts a minimal valid intent payload", () => {
    expect(paymentIntentSchema.safeParse(valid).success).toBe(true)
  })

  it("carbonOffsetCents defaults to 0 when omitted", () => {
    const r = paymentIntentSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.carbonOffsetCents).toBe(0)
  })
})
