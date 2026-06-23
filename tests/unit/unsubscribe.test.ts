import { describe, it, expect } from "vitest"
import { makeUnsubToken, verifyUnsubToken } from "@/lib/marketing/unsubscribe"

describe("unsubscribe tokens", () => {
  it("round-trips a valid token back to the userId", () => {
    const token = makeUnsubToken("user_abc123")
    expect(verifyUnsubToken(token)).toBe("user_abc123")
  })

  it("rejects a tampered signature", () => {
    const token = makeUnsubToken("user_abc123")
    const tampered = token.slice(0, -3) + "zzz"
    expect(verifyUnsubToken(tampered)).toBeNull()
  })

  it("rejects malformed / empty tokens", () => {
    expect(verifyUnsubToken("")).toBeNull()
    expect(verifyUnsubToken("nope")).toBeNull()
    expect(verifyUnsubToken("a.b.c")).toBeNull()
  })

  it("does not validate one user's token for another user", () => {
    const a = makeUnsubToken("user_a")
    const sigOfA = a.split(".")[1]
    const forged = `${Buffer.from("user_b").toString("base64url")}.${sigOfA}`
    expect(verifyUnsubToken(forged)).toBeNull()
  })
})
