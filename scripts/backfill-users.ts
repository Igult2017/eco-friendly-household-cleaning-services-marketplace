// One-off backfill: reconcile the users table against Clerk using the same
// logic as the admin "Sync from Clerk" safety net. Safe to re-run (idempotent).
// Run: node --import tsx --env-file=.env.local scripts/backfill-users.ts
import { syncClerkUsers } from "../lib/clerk/sync"

async function main() {
  const result = await syncClerkUsers()
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
