import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import { logger } from "hono/logger"
import { secureHeaders } from "hono/secure-headers"
import { requireAuth, type AppEnv } from "./auth.ts"
import { runMigrations } from "./db/index.ts"
import { env } from "./env.ts"
import { HttpError } from "./lib/http.ts"
import { providerRoutes, settingsRoutes, userRoutes, vendorRoutes } from "./routes/admin.ts"
import { authRoutes } from "./routes/auth.ts"
import { domainRoutes } from "./routes/domains.ts"
import { overviewRoutes } from "./routes/overview.ts"
import { serverRoutes } from "./routes/servers.ts"
import { heartbeatRoutes, serviceRoutes } from "./routes/services.ts"
import { startScheduler } from "./scheduler.ts"
import { startBot, stopBot } from "./telegram/bot.ts"

await runMigrations()

const app = new Hono<AppEnv>()
app.use(logger())
app.use(secureHeaders())

// CSRF: mutating API calls must be JSON (cross-site forms cannot send that without a CORS preflight)
app.use("/api/*", async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS", "DELETE"].includes(c.req.method) && !c.req.header("content-type")?.includes("application/json")) {
    return c.json({ error: "json_required" }, 415)
  }
  await next()
})

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.code, details: err.details }, err.status)
  console.error(err)
  return c.json({ error: "internal" }, 500)
})

app.get("/api/health", (c) => c.json({ ok: true }))
app.route("/api/auth", authRoutes)
app.route("/hb", heartbeatRoutes)

const api = new Hono<AppEnv>()
api.use("/*", requireAuth)
api.route("/users", userRoutes)
api.route("/providers", providerRoutes)
api.route("/vendors", vendorRoutes)
api.route("/settings", settingsRoutes)
api.route("/servers", serverRoutes)
api.route("/services", serviceRoutes)
api.route("/domains", domainRoutes)
api.route("/", overviewRoutes)
app.route("/api", api)
app.all("/api/*", (c) => c.json({ error: "not_found" }, 404))

// SPA (production)
if (env.webDist && existsSync(env.webDist)) {
  const indexHtml = readFileSync(join(env.webDist, "index.html"), "utf8")
  app.use("/*", serveStatic({ root: env.webDist }))
  app.get("*", (c) => c.html(indexHtml))
}

serve({ fetch: app.fetch, port: env.port }, (info) => console.log(`[http] listening on :${info.port}`))
await startBot()
startScheduler()

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await stopBot()
    process.exit(0)
  })
}
