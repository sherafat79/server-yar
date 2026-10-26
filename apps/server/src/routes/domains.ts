import { and, desc, eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import { domainSchema, renewSchema, type DomainDTO } from "@serveryar/shared"
import type { AppEnv } from "../auth.ts"
import { db, schema } from "../db/index.ts"
import { logActivity } from "../lib/activity.ts"
import { addMonths, todayTehran } from "../lib/dates.ts"
import { body, HttpError, idParam, notFound } from "../lib/http.ts"
import { refreshDomain } from "../monitor/domains.ts"

type Row = typeof schema.domains.$inferSelect
const { domains, services } = schema

async function toDTOs(rows: Row[]): Promise<DomainDTO[]> {
  const counts = await db.select({ id: services.domainId, n: sql<number>`count(*)` }).from(services).groupBy(services.domainId).all()
  const map = new Map(counts.map((r) => [r.id, r.n]))
  return rows.map((r) => ({ ...r, serviceCount: map.get(r.id) ?? 0 }))
}

async function getRow(id: number) {
  const row = await db.select().from(domains).where(eq(domains.id, id)).get()
  if (!row) throw notFound()
  return row
}

export const domainRoutes = new Hono<AppEnv>()

domainRoutes.get("/", async (c) => c.json(await toDTOs(await db.select().from(domains).orderBy(domains.name).all())))

domainRoutes.get("/:id", async (c) => {
  const [dto] = await toDTOs([await getRow(idParam(c))])
  return c.json(dto)
})

domainRoutes.post("/", async (c) => {
  const input = await body(c, domainSchema)
  if (await db.select().from(domains).where(eq(domains.name, input.name)).get()) throw new HttpError(409, "domain_exists")
  const [row] = await db.insert(domains).values(input).returning()
  await logActivity(c.get("user").id, "create", "domain", row!.id, `دامنه «${row!.name}» اضافه شد`)
  refreshDomain(row!.id).catch(() => {}) // fetch whois/SSL in the background
  const [dto] = await toDTOs([row!])
  return c.json(dto)
})

domainRoutes.patch("/:id", async (c) => {
  const id = idParam(c)
  const input = await body(c, domainSchema.partial())
  const [row] = await db.update(domains).set(input).where(eq(domains.id, id)).returning()
  if (!row) throw notFound()
  await logActivity(c.get("user").id, "update", "domain", id, `دامنه «${row.name}» ویرایش شد`)
  const [dto] = await toDTOs([row])
  return c.json(dto)
})

domainRoutes.delete("/:id", async (c) => {
  const id = idParam(c)
  const [row] = await db.delete(domains).where(eq(domains.id, id)).returning()
  if (!row) throw notFound()
  await logActivity(c.get("user").id, "delete", "domain", id, `دامنه «${row.name}» حذف شد`)
  return c.json({ ok: true })
})

domainRoutes.post("/:id/refresh", async (c) => {
  const id = idParam(c)
  await refreshDomain(id)
  const [dto] = await toDTOs([await getRow(id)])
  return c.json(dto)
})

domainRoutes.post("/:id/renew", async (c) => {
  const id = idParam(c)
  const input = await body(c, renewSchema)
  const row = await getRow(id)
  await renewDomain(row, {
    amount: input.amount ?? row.price ?? 0,
    currency: input.currency ?? row.currency,
    paidAt: input.paidAt ?? todayTehran(),
    note: input.note ?? null,
    userId: c.get("user").id,
  })
  const [dto] = await toDTOs([await getRow(id)])
  return c.json(dto)
})

export async function renewDomain(
  row: Row,
  p: { amount: number; currency: Row["currency"]; paidAt: string; note: string | null; userId: number | null },
) {
  const from = row.expiresAt ?? todayTehran()
  const to = addMonths(from, 12)
  await db.insert(schema.payments).values({ targetType: "domain", targetId: row.id, periodFrom: from, periodTo: to, ...p })
  await db.update(domains).set({ expiresAt: to }).where(eq(domains.id, row.id))
  await logActivity(p.userId, "renew", "domain", row.id, `دامنه «${row.name}» تا ${to} تمدید شد`)
}

domainRoutes.get("/:id/payments", async (c) => {
  const id = idParam(c)
  return c.json(
    await db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.targetType, "domain"), eq(schema.payments.targetId, id)))
      .orderBy(desc(schema.payments.paidAt))
      .all(),
  )
})
