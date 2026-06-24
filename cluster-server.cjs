// Multi-core entrypoint for the Next.js standalone server.
//
// A single Node process uses ~1 CPU core, so on a multi-core box the rest sit idle
// under load (this is what capped homepage throughput at ~27 req/s in load testing).
// This primary forks one worker per core; Node's cluster module shares the listening
// socket across workers (round-robin on Linux), so every worker serves on PORT.
//
// Reversible: revert the Dockerfile CMD back to `node server.js` to disable.
const cluster = require("cluster")
const os = require("os")
const path = require("path")

const CORES = os.cpus().length
const WORKERS = Math.max(1, parseInt(process.env.WEB_CONCURRENCY || "", 10) || CORES)

// Keep total Postgres connections (workers × per-worker pool) safely under
// Postgres max_connections (default 100). Split a fixed budget across workers so
// total stays ~constant regardless of core count.
const DB_BUDGET = parseInt(process.env.DB_POOL_BUDGET || "60", 10)
const perWorkerPool = Math.max(3, Math.floor(DB_BUDGET / WORKERS))

// Run each worker as the standalone server itself (respects its own module type).
cluster.setupPrimary({ exec: path.join(__dirname, "server.js") })

function fork(isFirst) {
  cluster.fork({
    DB_POOL_MAX: String(perWorkerPool),
    // Only the first worker runs boot migrations; others skip to avoid N concurrent runs.
    SKIP_BOOT_MIGRATE: isFirst ? "" : "1",
  })
}

console.log(`[cluster] cores=${CORES} workers=${WORKERS} dbPoolPerWorker=${perWorkerPool}`)
for (let i = 0; i < WORKERS; i++) fork(i === 0)

cluster.on("exit", (worker, code, signal) => {
  console.log(`[cluster] worker ${worker.process.pid} exited (code=${code}, signal=${signal}); respawning`)
  fork(false)
})
