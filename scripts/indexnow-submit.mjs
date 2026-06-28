// Ping IndexNow (Bing, Yandex, Seznam, …) about DORIXÉ's public pages so they get crawled/indexed
// fast — no search-console account needed. Re-run any time after publishing new content:
//   node scripts/indexnow-submit.mjs
// The key is auto-discovered from the public/<key>.txt file (hosted at the site root for verification).
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const HOST = "xn--dorix-fsa.com"
const ORIGIN = `https://${HOST}`

const pub = path.join(ROOT, "public")
const keyFile = fs.readdirSync(pub).find((f) => /^[a-f0-9]{16,128}\.txt$/.test(f))
if (!keyFile) { console.error("No IndexNow key file (public/<hex>.txt) found."); process.exit(1) }
const key = keyFile.replace(/\.txt$/, "")

const PATHS = [
  "/", "/browse", "/eco-store", "/become-a-cleaner", "/affiliate",
  "/how-it-works", "/pricing", "/sustainability", "/about", "/blog",
]
const urlList = PATHS.map((p) => `${ORIGIN}${p}`)

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList }),
})
const text = await res.text().catch(() => "")
console.log(`IndexNow → HTTP ${res.status} ${res.statusText}`)
console.log(`submitted ${urlList.length} URLs (key ${key})`)
if (text) console.log("response:", text.slice(0, 300))
// 200 = accepted; 202 = accepted, key validation pending; 400/403/422 = problem.
