import { and, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { maintenanceSchema, serviceSchema, type ServiceDTO, type ServiceInput } from "@serveryar/shared"
import type { AppEnv } from "../auth.ts"
import { db, schema } from "../db/index.ts"
import { logActivity } from "../lib/activity.ts"
import { randomToken } from "../lib/crypto.ts"
import { body, idParam, notFound } from "../lib/http.ts"
import { checkSeries, DAY, HOUR, uptimeMap } from "../lib/uptime.ts"

type Row = typeof schema.services.$inferSelect
const { services, domains } = schema

async function toDTOs(rows: Row[]): Promise<ServiceDTO[]> {
  const ids = rows.map((r) => r.id)
  const [u24, u7] = await Promise.all([uptimeMap("service", ids, DAY), uptimeMap("service", ids, 7 * DAY)])
  return rows.map(({ consecutiveFails: _c, lastHeartbeatAt: _h, sslExpiresAt: _s, ...r }) => ({
    ...r,
    uptime24h: u24.get(r.id) ?? null,
    uptime7d: u7.get(r.id) ?? null,
  }))
}

/** Fill domainId from the hostname when not chosen explicitly, and manage the heartbeat token. */
async function normalise(input: Partial<ServiceInput>, existing?: Row) {
  const out: Partial<Row> = { ...input }
  const host = input.hostname ?? existing?.hostname
  if (input.domainId === undefined && host && !existing?.domainId) {
    const all = await db.select({ id: domains.id, name: domains.name }).from(domains).all()
    const match = all
      .filter((d) => host === d.name || host.endsWith(`.${d.name}`))
      .sort((a, b) => b.name.length - a.name.length)[0]
    if (match) out.domainId = match.id
  }
  const method = input.checkMethod ?? existing?.checkMethod
  if (method === "heartbeat" && !existing?.heartbeatToken) out.heartbeatToken = randomToken(18)
  if (input.checkMethod && input.checkMethod !== existing?.checkMethod) {
    Object.assign(out, { status: "pending", consecutiveFails: 0, lastError: null })
  }
  return out
}

export const serviceRoutes = new Hono<AppEnv>()

serviceRoutes.get("/", async (c) => {
  const serverId = c.req.query("serverId")
  const domainId = c.req.query("domainId")
  const where = serverId
    ? serverId === "none"
      ? isNull(services.serverId)
      : eq(services.serverId, Number(serverId))
    : domainId
      ? eq(services.domainId, Number(domainId))
      : undefined
  const rows = await db.select().from(services).where(where).orderBy(services.name).all()
  return c.json(await toDTOs(rows))
})

serviceRoutes.get("/:id", async (c) => {
  const row = await db.select().from(services).where(eq(services.id, idParam(c))).get()
  if (!row) throw notFound()
  const [dto] = await toDTOs([row])
  return c.json(dto)
})

serviceRoutes.get("/:id/checks", async (c) => {
  const id = idParam(c)
  const range = c.req.query("range") ?? "24h"
  const [win, bucket] = range === "30d" ? [30 * DAY, 6 * HOUR] : range === "7d" ? [7 * DAY, HOUR] : [DAY, 10 * 60_000]
  return c.json(await checkSeries("service", id, win, bucket))
})

serviceRoutes.post("/", async (c) => {
  const input = await body(c, serviceSchema)
  const [row] = await db
    .insert(services)
    .values((await normalise(input)) as typeof services.$inferInsert)
    .returning()
  await logActivity(c.get("user").id, "create", "service", row!.id, `سرویس «${row!.name}» اضافه شد`)
  const [dto] = await toDTOs([row!])
  return c.json(dto)
})

serviceRoutes.patch("/:id", async (c) => {
  const id = idParam(c)
  const input = await body(c, serviceSchema.partial())
  const existing = await db.select().from(services).where(eq(services.id, id)).get()
  if (!existing) throw notFound()
  const [row] = await db
    .update(services)
    .set({ ...(await normalise(input, existing)), updatedAt: new Date().toISOString() })
    .where(eq(services.id, id))
    .returning()
  await logActivity(c.get("user").id, "update", "service", id, `سرویس «${row!.name}» ویرایش شد`)
  const [dto] = await toDTOs([row!])
  return c.json(dto)
})

serviceRoutes.delete("/:id", async (c) => {
  const id = idParam(c)
  const [row] = await db.delete(services).where(eq(services.id, id)).returning()
  if (!row) throw notFound()
  await db.delete(schema.checks).where(and(eq(schema.checks.targetType, "service"), eq(schema.checks.targetId, id)))
  await logActivity(c.get("user").id, "delete", "service", id, `سرویس «${row.name}» حذف شد`)
  return c.json({ ok: true })
})

serviceRoutes.post("/:id/heartbeat-token", async (c) => {
  const id = idParam(c)
  const [row] = await db.update(services).set({ heartbeatToken: randomToken(18) }).where(eq(services.id, id)).returning()
  if (!row) throw notFound()
  await logActivity(c.get("user").id, "update", "service", id, `توکن Heartbeat «${row.name}» عوض شد`)
  return c.json({ heartbeatToken: row.heartbeatToken })
})

serviceRoutes.post("/:id/maintenance", async (c) => {
  const id = idParam(c)
  const { until } = await body(c, maintenanceSchema)
  const [row] = await db
    .update(services)
    .set({ maintenanceUntil: until, status: until ? "maintenance" : "pending", consecutiveFails: 0 })
    .where(eq(services.id, id))
    .returning()
  if (!row) throw notFound()
  await logActivity(c.get("user").id, "maintenance", "service", id, until ? `سرویس «${row.name}» در حالت تعمیرات` : `پایان تعمیرات «${row.name}»`)
  return c.json({ ok: true })
})

/** Public heartbeat endpoint: GET/POST /hb/:token */
export const heartbeatRoutes = new Hono()
heartbeatRoutes.all("/:token", async (c) => {
  const [row] = await db
    .update(services)
    .set({ lastHeartbeatAt: new Date().toISOString() })
    .where(and(eq(services.heartbeatToken, c.req.param("token")), eq(services.checkMethod, "heartbeat")))
    .returning({ id: services.id })
  if (!row) return c.text("not found", 404)
  return c.text("ok")
})
