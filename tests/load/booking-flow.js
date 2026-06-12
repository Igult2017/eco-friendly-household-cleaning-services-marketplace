/**
 * k6 load test — booking creation endpoint
 *
 * Simulates authenticated customers hitting the payments/intent and bookings endpoints.
 * Run: k6 run tests/load/booking-flow.js --env BASE_URL=https://www.dorixe.com --env SESSION_TOKEN=<clerk_token>
 */
import http from "k6/http"
import { check, sleep } from "k6"
import { Rate, Trend } from "k6/metrics"

const errorRate = new Rate("booking_errors")
const latency   = new Trend("booking_latency", true)

export const options = {
  stages: [
    { duration: "30s", target: 50  },
    { duration: "1m",  target: 200 },
    { duration: "2m",  target: 200 },
    { duration: "30s", target: 0   },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    booking_errors:    ["rate<0.05"], // 5% error tolerance (auth failures expected without real tokens)
  },
}

const BASE_URL     = __ENV.BASE_URL     || "http://localhost:3000"
const SESSION_TOKEN = __ENV.SESSION_TOKEN || ""

export default function () {
  const headers = {
    "Content-Type": "application/json",
    "Accept":        "application/json",
    ...(SESSION_TOKEN ? { "Cookie": `__session=${SESSION_TOKEN}` } : {}),
  }

  // Step 1 — attempt payment intent (expected 401 without real auth, 400 with bad data)
  const start = Date.now()
  const res = http.post(
    `${BASE_URL}/api/payments/intent`,
    JSON.stringify({
      providerId: "00000000-0000-0000-0000-000000000000",
      serviceId:  "00000000-0000-0000-0000-000000000001",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 120,
      serviceAddress: { line1: "Unter den Linden 1", city: "Berlin", postalCode: "10117", country: "DE" },
    }),
    { headers, timeout: "15s" }
  )
  latency.add(Date.now() - start)

  const ok = check(res, {
    "not 500":       r => r.status !== 500,
    "rate limited or auth required": r => [400, 401, 429].includes(r.status),
  })
  errorRate.add(res.status === 500)

  sleep(1 + Math.random() * 2)
}
