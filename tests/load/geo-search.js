/**
 * k6 load test — geo search endpoint
 *
 * Simulates 5,000 concurrent users browsing for providers.
 * Run: k6 run tests/load/geo-search.js --env BASE_URL=https://www.dorixe.com
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 */
import http from "k6/http"
import { check, sleep } from "k6"
import { Trend, Rate, Counter } from "k6/metrics"

const latency   = new Trend("geo_search_latency",   true)
const errorRate = new Rate("geo_search_errors")
const requests  = new Counter("geo_search_requests")

// Berlin, Hamburg, Munich, Cologne, Frankfurt — representative EU cities
const LOCATIONS = [
  { lat: 52.52,  lng: 13.405, label: "Berlin"    },
  { lat: 53.551, lng: 9.993,  label: "Hamburg"   },
  { lat: 48.137, lng: 11.575, label: "Munich"    },
  { lat: 50.938, lng: 6.960,  label: "Cologne"   },
  { lat: 50.110, lng: 8.682,  label: "Frankfurt" },
]

export const options = {
  stages: [
    { duration: "30s", target: 100  }, // ramp-up to 100 VUs
    { duration: "1m",  target: 500  }, // ramp to 500
    { duration: "2m",  target: 1000 }, // hold at 1000 (simulates 1k concurrent)
    { duration: "1m",  target: 5000 }, // spike to 5k
    { duration: "30s", target: 0    }, // ramp down
  ],
  thresholds: {
    http_req_duration:    ["p(95)<800"],  // 95% of requests under 800ms
    geo_search_errors:    ["rate<0.02"],  // less than 2% errors
    geo_search_latency:   ["p(99)<2000"], // 99th percentile under 2s
  },
}

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"

export default function () {
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)]
  const radius = 10 + Math.floor(Math.random() * 40) // 10–50km

  const url = `${BASE_URL}/api/geo/providers?lat=${loc.lat}&lng=${loc.lng}&radius=${radius}`

  const start = Date.now()
  const res = http.get(url, {
    headers: { "Accept": "application/json" },
    timeout: "10s",
  })
  const elapsed = Date.now() - start

  latency.add(elapsed)
  requests.add(1)

  const ok = check(res, {
    "status 200":           r => r.status === 200,
    "has providers array":  r => { try { return Array.isArray(JSON.parse(r.body).providers) } catch { return false } },
    "response time < 1s":   r => r.timings.duration < 1000,
  })

  errorRate.add(!ok)

  sleep(0.5 + Math.random() * 1.5) // think time 0.5–2s
}

export function handleSummary(data) {
  return {
    "tests/load/results/geo-search-summary.json": JSON.stringify(data, null, 2),
  }
}
