import { and, eq, gte, inArray, sql } from "drizzle-orm"
import type { CheckPoint } from "@serveryar/shared"
import { db, schema } from "../db/index.ts"

const { checks } = schema
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/** Uptime % per target id over the window. Missing = no data. */
export async function uptimeMap(targetType: "server" | "service", ids: number[], windowMs: number) {
  const out = new Map<number, number>()
  if (!ids.length) return out
  const rows = await db
    .select({
      id: checks.targetId,
      total: sql<number>`count(*)`,
      ok: sql<number>`sum(${checks.ok})`,
    })
    .from(checks)
    .where(and(eq(checks.targetType, targetType), inArray(checks.targetId, ids), gte(checks.ts, Date.now() - windowMs)))
    .groupBy(checks.targetId)
    .all()
  for (const r of rows) if (r.total > 0) out.set(r.id, Math.round((r.ok / r.total) * 10000) / 100)
  return out
}

/** Bucketed check history for charts. */
export async function checkSeries(
  targetType: "server" | "service",
  id: number,
  windowMs: number,
  bucketMs: number,
): Promise<CheckPoint[]> {
  const since = Date.now() - windowMs
  const rows = await db
    .select({
      bucket: sql<number>`(${checks.ts} / ${sql.raw(String(bucketMs))}) * ${sql.raw(String(bucketMs))}`,
      total: sql<number>`count(*)`,
      ok: sql<number>`sum(${checks.ok})`,
      ms: sql<number | null>`avg(${checks.latencyMs})`,
    })
    .from(checks)
    .where(and(eq(checks.targetType, targetType), eq(checks.targetId, id), gte(checks.ts, since)))
    .groupBy(sql`1`)
    .orderBy(sql`1`)
    .all()
  return rows.map((r) => ({
    t: new Date(r.bucket).toISOString(),
    ok: r.ok === r.total,
    ms: r.ms === null ? null : Math.round(r.ms),
  }))
}

/** Overall daily uptime for all targets over the last N days (Tehran day boundaries approximated in UTC+3:30). */
export async function dailyUptime(days: number) {
  const offset = 3.5 * HOUR
  const since = Date.now() - days * DAY
  const rows = await db
    .select({
      day: sql<number>`((${checks.ts} + ${sql.raw(String(offset))}) / ${sql.raw(String(DAY))})`,
      total: sql<number>`count(*)`,
      ok: sql<number>`sum(${checks.ok})`,
    })
    .from(checks)
    .where(gte(checks.ts, since))
    .groupBy(sql`1`)
    .orderBy(sql`1`)
    .all()
  const byDay = new Map(rows.map((r) => [r.day, r]))
  const today = Math.floor((Date.now() + offset) / DAY)
  const out: { date: string; uptime: number | null }[] = []
  for (let d = today - days + 1; d <= today; d++) {
    const r = byDay.get(d)
    out.push({
      date: new Date(d * DAY).toISOString().slice(0, 10),
      uptime: r && r.total ? Math.round((r.ok / r.total) * 10000) / 100 : null,
    })
  }
  return out
}
