import { and, desc, eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import { CYCLE_MONTHS, maintenanceSchema, renewSchema, revealSchema, serverSchema, type ServerDTO } from "@serveryar/shared"
import { canReveal, verifyTotp, type AppEnv } from "../auth.ts"
import { db, schema } from "../db/index.ts"
import { logActivity } from "../lib/activity.ts"
import { decrypt, secretUpdate } from "../lib/crypto.ts"
import { addMonths, todayTehran } from "../lib/dates.ts"
import { body, HttpError, idParam, notFound } from "../lib/http.ts"
import { checkSeries, DAY, HOUR, uptimeMap } from "../lib/uptime.ts"

type Row = typeof schema.servers.$inferSelect
const { servers, services } = schema

async function toDTOs(rows: Row[]): Promise<ServerDTO[]> {
  const ids = rows.map((r) => r.id)
  const [u24, u7, u30, counts] = await Promise.all([
    uptimeMap("server", ids, DAY),
    uptimeMap("server", ids, 7 * DAY),
    uptimeMap("server", ids, 30 * DAY),
    db
      .select({ id: services.serverId, n: sql<number>`count(*)` })
      .from(services)
      .groupBy(services.serverId)
      .all(),
  ])
  const countMap = new Map(counts.map((r) => [r.id, r.n]))
  return rows.map((r) => {
    const { sshPassword, sshKey, panelPassword, consecutiveFails: _cf, lastError: _le, ...rest } = r
    return {
      ...rest,
      hasSshPassword: !!sshPassword,
      hasSshKey: !!sshKey,
      hasPanelPassword: !!panelPassword,
      uptime24h: u24.get(r.id) ?? null,
      uptime7d: u7.get(r.id) ?? null,
      uptime30d: u30.get(r.id) ?? null,
      serviceCount: countMap.get(r.id) ?? 0,
    }
  })
}

export async function getServerRow(id: number) {
  const row = await db.select().from(servers).where(eq(servers.id, id)).get()
  if (!row) throw notFound()
  return row
}

export const serverRoutes = new Hono<AppEnv>()

serverRoutes.get("/", async (c) => {
  const rows = await db.select().from(servers).orderBy(servers.name).all()
  return c.json(await toDTOs(rows))
})

serverRoutes.get("/:id", async (c) => {
  const [dto] = await toDTOs([await getServerRow(idParam(c))])
  return c.json(dto)
})

serverRoutes.get("/:id/checks", async (c) => {
  const id = idParam(c)
  const range = c.req.query("range") ?? "24h"
  const [win, bucket] = range === "30d" ? [30 * DAY, 6 * HOUR] : range === "7d" ? [7 * DAY, HOUR] : [DAY, 10 * 60_000]
  return c.json(await checkSeries("server", id, win, bucket))
})

function secretPatch(input: { sshPassword?: string | null; sshKey?: string | null; panelPassword?: string | null }) {
  const out: Partial<Row> = {}
  for (const k of ["sshPassword", "sshKey", "panelPassword"] as const) {
    const v = secretUpdate(input[k])
    if (v !== undefined) out[k] = v
  }
  return out
}

serverRoutes.post("/", async (c) => {
  const input = await body(c, serverSchema)
  const { sshPassword, sshKey, panelPassword, ...plain } = input
  const [row] = await db
    .insert(servers)
    .values({ ...plain, ...secretPatch({ sshPassword, sshKey, panelPassword }) })
    .returning()
  await logActivity(c.get("user").id, "create", "server", row!.id, `سرور «${row!.name}» اضافه شد`)
  const [dto] = await toDTOs([row!])
  return c.json(dto)
})

serverRoutes.patch("/:id", async (c) => {
  const id = idParam(c)
  const input = await body(c, serverSchema.partial())
  const { sshPassword, sshKey, panelPassword, ...plain } = input
  const [row] = await db
    .update(servers)
    .set({ ...plain, ...secretPatch({ sshPassword, sshKey, panelPassword }), updatedAt: new Date().toISOString() })
    .where(eq(servers.id, id))
    .returning()
  if (!row) throw notFound()
  await logActivity(c.get("user").id, "update", "server", id, `سرور «${row.name}» ویرایش شد`)
  const [dto] = await toDTOs([row])
  return c.json(dto)
})

serverRoutes.delete("/:id", async (c) => {
  const id = idParam(c)
  const [row] = await db.delete(servers).where(eq(servers.id, id)).returning()
  if (!row) throw notFound()
  await db.delete(schema.checks).where(and(eq(schema.checks.targetType, "server"), eq(schema.checks.targetId, id)))
  await logActivity(c.get("user").id, "delete", "server", id, `سرور «${row.name}» حذف شد`)
  return c.json({ ok: true })
})

serverRoutes.post("/:id/renew", async (c) => {
  const id = idParam(c)
  const input = await body(c, renewSchema)
  const row = await getServerRow(id)
  const from = row.nextRenewal ?? todayTehran()
  const to = addMonths(from, CYCLE_MONTHS[row.billingCycle])
  await renewServer(row, to, {
    amount: input.amount ?? row.price ?? 0,
    currency: input.currency ?? row.currency,
    paidAt: input.paidAt ?? todayTehran(),
    note: input.note ?? null,
    userId: c.get("user").id,
  })
  const [dto] = await toDTOs([await getServerRow(id)])
  return c.json(dto)
})

export async function renewServer(
  row: Row,
  to: string,
  p: { amount: number; currency: Row["currency"]; paidAt: string; note: string | null; userId: number | null },
) {
  const from = row.nextRenewal ?? todayTehran()
  await db.insert(schema.payments).values({ targetType: "server", targetId: row.id, periodFrom: from, periodTo: to, ...p })
  await db.update(servers).set({ nextRenewal: to, updatedAt: new Date().toISOString() }).where(eq(servers.id, row.id))
  await logActivity(p.userId, "renew", "server", row.id, `سرور «${row.name}» تا ${to} تمدید شد`)
}

serverRoutes.post("/:id/maintenance", async (c) => {
  const id = idParam(c)
  const { until } = await body(c, maintenanceSchema)
  const [row] = await db
    .update(servers)
    .set({ maintenanceUntil: until, status: until ? "maintenance" : "pending", consecutiveFails: 0 })
    .where(eq(servers.id, id))
    .returning()
  if (!row) throw notFound()
  await logActivity(c.get("user").id, "maintenance", "server", id, until ? `سرور «${row.name}» در حالت تعمیرات` : `پایان تعمیرات «${row.name}»`)
  return c.json({ ok: true })
})

serverRoutes.post("/:id/reveal", async (c) => {
  const id = idParam(c)
  const user = c.get("user")
  if (!canReveal(user)) throw new HttpError(403, "forbidden")
  const { field, otp } = await body(c, revealSchema)
  if (!(await verifyTotp(user, otp))) throw new HttpError(400, "invalid_otp")
  const row = await getServerRow(id)
  const enc = row[field]
  if (!enc) throw notFound()
  const label = { sshPassword: "رمز SSH", sshKey: "کلید SSH", panelPassword: "رمز پنل" }[field]
  await logActivity(user.id, "reveal", "server", id, `${label} سرور «${row.name}» مشاهده شد`)
  return c.json({ value: decrypt(enc), expiresInSec: 30 })
})

serverRoutes.get("/:id/payments", async (c) => {
  const id = idParam(c)
  const rows = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.targetType, "server"), eq(schema.payments.targetId, id)))
    .orderBy(desc(schema.payments.paidAt))
    .all()
  return c.json(rows)
})
