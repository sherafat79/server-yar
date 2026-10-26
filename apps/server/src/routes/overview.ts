import { and, desc, eq, gte, lte, sql } from "drizzle-orm"
import { Hono } from "hono"
import {
  monthlyCost,
  type ActivityDTO,
  type Currency,
  type DashboardDTO,
  type IncidentDTO,
  type PaymentDTO,
  type RenewalItem,
} from "@serveryar/shared"
import type { AppEnv } from "../auth.ts"
import { db, schema } from "../db/index.ts"
import { daysLeft } from "../lib/dates.ts"
import { HttpError, idParam } from "../lib/http.ts"
import { dailyUptime } from "../lib/uptime.ts"

const { servers, services, domains, incidents, payments, activity, users, providers } = schema

export async function upcomingRenewals(withinDays: number): Promise<RenewalItem[]> {
  const [srv, dom] = await Promise.all([
    db.select().from(servers).where(eq(servers.archived, false)).all(),
    db.select().from(domains).all(),
  ])
  const items: RenewalItem[] = []
  for (const s of srv) {
    if (!s.nextRenewal) continue
    items.push({ type: "server", id: s.id, name: s.name, date: s.nextRenewal, daysLeft: daysLeft(s.nextRenewal), price: s.price, currency: s.currency, autoRenew: s.autoRenew })
  }
  for (const d of dom) {
    if (!d.expiresAt) continue
    items.push({ type: "domain", id: d.id, name: d.name, date: d.expiresAt, daysLeft: daysLeft(d.expiresAt), price: d.price, currency: d.currency, autoRenew: d.autoRenew })
  }
  return items.filter((i) => i.daysLeft <= withinDays).sort((a, b) => a.daysLeft - b.daysLeft)
}

async function costs() {
  const [srv, dom, prov] = await Promise.all([
    db.select().from(servers).where(eq(servers.archived, false)).all(),
    db.select().from(domains).all(),
    db.select().from(providers).all(),
  ])
  const provName = new Map(prov.map((p) => [p.id, p.name]))
  const monthly: Partial<Record<Currency, number>> = {}
  const byProvider = new Map<string, { provider: string; currency: Currency; monthly: number }>()
  const add = (cur: Currency, v: number) => (monthly[cur] = (monthly[cur] ?? 0) + v)
  for (const s of srv) {
    if (!s.price) continue
    const m = monthlyCost(s.price, s.billingCycle)
    add(s.currency, m)
    const provider = (s.providerId && provName.get(s.providerId)) || "نامشخص"
    const key = `${provider}|${s.currency}`
    const e = byProvider.get(key) ?? { provider, currency: s.currency, monthly: 0 }
    e.monthly += m
    byProvider.set(key, e)
  }
  for (const d of dom) if (d.price) add(d.currency, d.price / 12)
  const round = (v: number) => Math.round(v * 100) / 100
  const yearly = Object.fromEntries(Object.entries(monthly).map(([k, v]) => [k, round(v * 12)]))
  for (const k of Object.keys(monthly) as Currency[]) monthly[k] = round(monthly[k]!)
  return {
    monthly,
    yearly,
    byProvider: [...byProvider.values()].map((e) => ({ ...e, monthly: round(e.monthly) })).sort((a, b) => b.monthly - a.monthly),
  }
}

async function incidentList(limit: number, targetType?: "server" | "service", targetId?: number): Promise<IncidentDTO[]> {
  const where = targetType && targetId ? and(eq(incidents.targetType, targetType), eq(incidents.targetId, targetId)) : undefined
  const rows = await db.select().from(incidents).where(where).orderBy(desc(incidents.startedAt)).limit(limit).all()
  const [srv, svc] = await Promise.all([
    db.select({ id: servers.id, name: servers.name }).from(servers).all(),
    db.select({ id: services.id, name: services.name }).from(services).all(),
  ])
  const names = { server: new Map(srv.map((s) => [s.id, s.name])), service: new Map(svc.map((s) => [s.id, s.name])) }
  return rows.map((r) => ({ ...r, targetName: names[r.targetType].get(r.targetId) ?? "(حذف‌شده)" }))
}

export const overviewRoutes = new Hono<AppEnv>()

overviewRoutes.get("/dashboard", async (c) => {
  const [srv, svc, upcoming, cost, uptimeSeries, recentIncidents] = await Promise.all([
    db.select({ status: servers.status }).from(servers).where(eq(servers.archived, false)).all(),
    db.select().from(services).orderBy(services.name).all(),
    upcomingRenewals(60),
    costs(),
    dailyUptime(7),
    incidentList(8),
  ])
  const tally = (rows: { status: string }[]) => ({
    total: rows.length,
    up: rows.filter((r) => r.status === "up").length,
    down: rows.filter((r) => r.status === "down").length,
    maintenance: rows.filter((r) => r.status === "maintenance").length,
  })
  const dto: DashboardDTO = {
    servers: tally(srv),
    services: tally(svc),
    renewals30d: upcoming.filter((u) => u.daysLeft <= 30).length,
    monthlyCost: cost.monthly,
    yearlyCost: cost.yearly,
    upcoming,
    costByProvider: cost.byProvider,
    uptimeSeries,
    recentIncidents,
    liveServices: svc
      .filter((s) => s.checkMethod !== "none")
      .map((s) => ({ id: s.id, name: s.name, type: s.type, status: s.status, latencyMs: s.latencyMs, hostname: s.hostname })),
  }
  return c.json(dto)
})

overviewRoutes.get("/renewals", async (c) => c.json(await upcomingRenewals(Number(c.req.query("days") ?? 365))))

overviewRoutes.get("/costs", async (c) => c.json(await costs()))

overviewRoutes.get("/incidents", async (c) => {
  const t = c.req.query("targetType") as "server" | "service" | undefined
  const id = c.req.query("targetId")
  return c.json(await incidentList(Number(c.req.query("limit") ?? 100), t, id ? Number(id) : undefined))
})

overviewRoutes.get("/payments", async (c) => {
  const from = c.req.query("from")
  const to = c.req.query("to")
  const rows = await db
    .select({ p: payments, userName: users.displayName })
    .from(payments)
    .leftJoin(users, eq(payments.userId, users.id))
    .where(and(from ? gte(payments.paidAt, from) : undefined, to ? lte(payments.paidAt, to) : undefined))
    .orderBy(desc(payments.paidAt), desc(payments.id))
    .all()
  const [srv, dom] = await Promise.all([
    db.select({ id: servers.id, name: servers.name }).from(servers).all(),
    db.select({ id: domains.id, name: domains.name }).from(domains).all(),
  ])
  const names = { server: new Map(srv.map((s) => [s.id, s.name])), domain: new Map(dom.map((d) => [d.id, d.name])) }
  const out: PaymentDTO[] = rows.map(({ p, userName }) => ({
    id: p.id,
    targetType: p.targetType,
    targetId: p.targetId,
    targetName: names[p.targetType].get(p.targetId) ?? "(حذف‌شده)",
    amount: p.amount,
    currency: p.currency,
    paidAt: p.paidAt,
    periodFrom: p.periodFrom,
    periodTo: p.periodTo,
    note: p.note,
    userName,
  }))
  return c.json(out)
})

overviewRoutes.delete("/payments/:id", async (c) => {
  if (c.get("user").role !== "admin") throw new HttpError(403, "forbidden")
  await db.delete(payments).where(eq(payments.id, idParam(c)))
  return c.json({ ok: true })
})

/** Monthly totals of actual payments per currency (last 12 months). */
overviewRoutes.get("/payments/monthly", async (c) => {
  const rows = await db
    .select({ month: sql<string>`substr(${payments.paidAt}, 1, 7)`, currency: payments.currency, total: sql<number>`sum(${payments.amount})` })
    .from(payments)
    .groupBy(sql`1`, payments.currency)
    .orderBy(sql`1`)
    .all()
  return c.json(rows.slice(-36))
})

overviewRoutes.get("/activity", async (c) => {
  const rows = await db
    .select({ a: activity, userName: users.displayName })
    .from(activity)
    .leftJoin(users, eq(activity.userId, users.id))
    .orderBy(desc(activity.id))
    .limit(Number(c.req.query("limit") ?? 200))
    .all()
  const out: ActivityDTO[] = rows.map(({ a, userName }) => ({ ...a, userName }))
  return c.json(out)
})
