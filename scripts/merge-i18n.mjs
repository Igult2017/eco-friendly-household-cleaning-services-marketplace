import fs from "fs"

// Usage: node scripts/merge-i18n.mjs <workflow-output-file>
const OUT = process.argv[2]
const LOCALES = ["en", "de", "fr", "es", "it", "nl", "pl", "pt"]

const raw = fs.readFileSync(OUT, "utf8")
let data
try {
  data = JSON.parse(raw)
} catch {
  const i = raw.indexOf('{"merged"')
  data = JSON.parse(raw.slice(i))
}
let merged = data.merged
if (!merged && data.result) {
  const r = typeof data.result === "string" ? JSON.parse(data.result) : data.result
  merged = r.merged
}
if (!merged) {
  console.error("Could not locate `merged`. Top keys:", Object.keys(data))
  process.exit(1)
}

const nsList = Object.keys(merged.en)
let issues = 0
for (const ns of nsList) {
  const enKeys = Object.keys(merged.en[ns] || {}).sort().join(",")
  for (const l of LOCALES) {
    const k = Object.keys((merged[l] || {})[ns] || {}).sort().join(",")
    if (k !== enKeys) {
      console.log(`KEY MISMATCH ns=${ns} locale=${l}`)
      issues++
    }
  }
}
console.log("new namespaces:", nsList.length, "| key-parity issues:", issues)

for (const l of LOCALES) {
  const p = `messages/${l}.json`
  const existing = JSON.parse(fs.readFileSync(p, "utf8"))
  const next = { ...existing, ...merged[l] }
  fs.writeFileSync(p, JSON.stringify(next, null, 2) + "\n")
  console.log("wrote", p, "->", Object.keys(next).length, "namespaces total")
}
