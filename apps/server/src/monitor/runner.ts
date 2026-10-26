import { and, eq, isNull } from "drizzle-orm"
import { db, schema } from "../db/index.ts"
import { formatDuration, nowIso } from "../lib/dates.ts"
import { notify, esc } from "../telegram/bot.ts"
import { http, icmp, pool, tcp, type ProbeResult } from "./probes.ts"

const FAILS_BEFORE_DOWN = 2
const { servers, services, checks, incidents } = schema

type Target = "server" | "service"

async function probeServer(s: typeof servers.$inferSelect): Promise<ProbeResult> {
  const host = s.ips[0]
  if (!host) return { ok: false, ms: null, error: "IP ثبت نشده" }
  const p = await icmp(host)
  if (p.ok) return p
  // many hosts drop ICMP — fall back to the SSH port
  const t = await tcp(host, s.sshPort ?? 22)
  return t.ok ? t : { ok: false, ms: null, error: `${p.error}; ${t.error}` }
}

async function probeService(
  s: typeof services.$inferSelect,
  serverIp: string | undefined,
): Promise<ProbeResult | null> {
  switch (s.checkMethod) {
    case "http": {
      const url = s.checkUrl || (s.hostname ? `https://${s.hostname}${s.port ? `:${s.port}` : ""}` : null)
      return url ? http(url, s.checkKeyword) : { ok: false, ms: null, error: "URL چک ثبت نشده" }
    }
    case "tcp": {
      const host = s.hostname || serverIp
      if (!host || !s.port) return { ok: false, ms: null, error: "هاست یا پورت ثبت نشده" }
      return tcp(host, s.port)
    }
    case "heartbeat": {
      const last = s.lastHeartbeatAt ? Date.parse(s.lastHeartbeatAt) : Date.parse(s.createdAt)
      const age = Date.now() - last
      return age <= s.heartbeatGraceSec * 1000
        ? { ok: true, ms: null }
        : { ok: false, ms: null, error: `آخرین Heartbeat ${formatDuration(age)} پیش` }
    }
    default:
      return null
  }
}

/** Apply a probe result: store the check, flip status after N consecutive fails, open/close incidents, notify. */
async function record(
  type: Target,
  row: { id: number; name: string; status: string; consecutiveFails: number },
  r: ProbeResult,
) {
  const table = type === "server" ? servers : services
  const ts = Date.now()
  await db.insert(checks).values({ targetType: type, targetId: row.id, ts, ok: r.ok, latencyMs: r.ms })

  const fails = r.ok ? 0 : row.consecutiveFails + 1
  let status = row.status
  if (r.ok) status = "up"
  else if (fails >= FAILS_BEFORE_DOWN) status = "down"
  else if (row.status === "pending") status = "pending"

  await db
    .update(table)
    .set({ status: status as "up", consecutiveFails: fails, lastCheckedAt: new Date(ts).toISOString(), latencyMs: r.ms, lastError: r.ok ? null : (r.error ?? null) })
    .where(eq(table.id, row.id))

  const label = type === "server" ? "سرور" : "سرویس"
  if (status === "down" && row.status !== "down") {
    await db.insert(incidents).values({ targetType: type, targetId: row.id, startedAt: nowIso(), cause: r.error ?? null })
    await notify(`🔴 <b>${label} «${esc(row.name)}» از دسترس خارج شد</b>\n${esc(r.error ?? "")}`)
  } else if (status === "up" && row.status === "down") {
    const open = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.targetType, type), eq(incidents.targetId, row.id), isNull(incidents.resolvedAt)))
      .all()
    for (const inc of open) await db.update(incidents).set({ resolvedAt: nowIso() }).where(eq(incidents.id, inc.id))
    const since = open[0] ? formatDuration(Date.now() - Date.parse(open[0].startedAt)) : null
    await notify(`🟢 <b>${label} «${esc(row.name)}» دوباره در دسترس است</b>${since ? `\nمدت قطعی: ${since}` : ""}`)
  }
}

/** Ends expired maintenance windows. */
async function expireMaintenance() {
  const now = nowIso()
  for (const table of [servers, services]) {
    const rows = await db.select({ id: table.id, until: table.maintenanceUntil }).from(table).all()
    for (const r of rows) {
      if (r.until && r.until <= now) {
        await db.update(table).set({ maintenanceUntil: null, status: "pending", consecutiveFails: 0 }).where(eq(table.id, r.id))
      }
    }
  }
}

let running = false
export async function runChecks() {
  if (running) return
  running = true
  try {
    await expireMaintenance()
    const srv = await db.select().from(servers).where(and(eq(servers.archived, false), eq(servers.monitor, true))).all()
    const svc = await db.select().from(services).all()
    const allServers = await db.select({ id: servers.id, ips: servers.ips, archived: servers.archived }).from(servers).all()
    const serverById = new Map(allServers.map((s) => [s.id, s]))

    await pool(srv.filter((s) => !s.maintenanceUntil), 10, async (s) => record("server", s, await probeServer(s)))
    await pool(
      svc.filter((s) => !s.maintenanceUntil && s.checkMethod !== "none" && !(s.serverId && serverById.get(s.serverId)?.archived)),
      10,
      async (s) => {
        const r = await probeService(s, s.serverId ? serverById.get(s.serverId)?.ips[0] : undefined)
        if (r) await record("service", s, r)
      },
    )
  } finally {
    running = false
  }
}
