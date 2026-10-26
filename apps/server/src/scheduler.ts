import { readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Cron } from "croner"
import { eq, lt } from "drizzle-orm"
import { client, db, schema } from "./db/index.ts"
import { env } from "./env.ts"
import { addMonths, daysLeft, formatJalali, tehranHour, todayTehran } from "./lib/dates.ts"
import { getSettings } from "./lib/settings.ts"
import { DAY, HOUR } from "./lib/uptime.ts"
import { refreshAllDomains, refreshServiceCerts } from "./monitor/domains.ts"
import { runChecks } from "./monitor/runner.ts"
import { renewDomain } from "./routes/domains.ts"
import { upcomingRenewals } from "./routes/overview.ts"
import { renewServer } from "./routes/servers.ts"
import { CYCLE_MONTHS } from "@serveryar/shared"
import { esc, notify, sendToAdmins } from "./telegram/bot.ts"

/** Returns true the first time a key is seen. */
async function once(key: string): Promise<boolean> {
  const res = await db.insert(schema.sentNotifications).values({ key }).onConflictDoNothing().returning()
  return res.length > 0
}

const when = (d: number) => (d === 0 ? "<b>امروز</b>" : d < 0 ? `<b>${-d} روز پیش</b>` : `<b>${d} روز دیگر</b>`)

export async function sendReminders() {
  const s = await getSettings()
  const items = await upcomingRenewals(Math.max(...s.reminderDays, 0))
  for (const i of items) {
    const kind = i.type === "server" ? "🖥 سرور" : "🌐 دامنه"
    const price = i.price ? `\n💰 ${i.price.toLocaleString("en-US")} ${i.currency}` : ""

    if (i.autoRenew && i.daysLeft < 0) {
      if (i.type === "server") {
        const row = await db.select().from(schema.servers).where(eq(schema.servers.id, i.id)).get()
        if (row?.nextRenewal) {
          const to = addMonths(row.nextRenewal, CYCLE_MONTHS[row.billingCycle])
          await renewServer(row, to, { amount: row.price ?? 0, currency: row.currency, paidAt: row.nextRenewal, note: "تمدید خودکار", userId: null })
        }
      } else {
        const row = await db.select().from(schema.domains).where(eq(schema.domains.id, i.id)).get()
        if (row) await renewDomain(row, { amount: row.price ?? 0, currency: row.currency, paidAt: row.expiresAt ?? todayTehran(), note: "تمدید خودکار", userId: null })
      }
      await notify(`🔁 ${kind} «${esc(i.name)}» به‌صورت خودکار تمدید و پرداختش ثبت شد.`)
      continue
    }

    const due = s.reminderDays.includes(i.daysLeft) || (i.daysLeft < 0 && i.daysLeft >= -3)
    if (!due || !(await once(`renew:${i.type}:${i.id}:${i.date}:${i.daysLeft}`))) continue
    const icon = i.daysLeft < 0 ? "⛔️" : i.daysLeft <= 1 ? "🔴" : i.daysLeft <= 3 ? "🟠" : "🟡"
    await notify(
      `${icon} <b>یادآوری تمدید</b>\n${kind} «${esc(i.name)}»\n📅 ${formatJalali(i.date)} (${i.date}) — ${when(i.daysLeft)}${price}${i.autoRenew ? "\n🔁 تمدید خودکار فعال است" : ""}`,
    )
  }

  // SSL certificates
  const certs: { name: string; exp: string | null }[] = [
    ...(await db.select({ name: schema.domains.name, exp: schema.domains.sslExpiresAt }).from(schema.domains).all()),
    ...(await db.select({ name: schema.services.name, exp: schema.services.sslExpiresAt }).from(schema.services).all()),
  ]
  for (const c of certs) {
    if (!c.exp) continue
    const d = daysLeft(c.exp.slice(0, 10))
    if (!s.sslReminderDays.includes(d) && !(d < 0 && d >= -1)) continue
    if (!(await once(`ssl:${c.name}:${c.exp}:${d}`))) continue
    await notify(`🔐 <b>گواهی SSL</b> «${esc(c.name)}» ${d < 0 ? "منقضی شده" : `${when(d)} منقضی می‌شود`} (${formatJalali(c.exp)})`)
  }
}

export async function backupDatabase() {
  const file = join(tmpdir(), `serveryar-${todayTehran()}-${Date.now()}.db`)
  try {
    await client.execute({ sql: "VACUUM INTO ?", args: [file] })
    const buf = await readFile(file)
    await sendToAdmins(buf, `serveryar-${todayTehran()}.db`, `💾 بکاپ روزانهٔ سرور یار — ${formatJalali(new Date())}\nرمزها با ENCRYPTION_KEY رمزنگاری شده‌اند.`)
  } finally {
    await rm(file, { force: true })
  }
}

/** Roll checks older than 30 days into hourly buckets, then delete them. */
export async function compactChecks() {
  const cutoff = Math.floor((Date.now() - 30 * DAY) / HOUR) * HOUR
  await client.execute({
    sql: `INSERT INTO checks_hourly (target_type, target_id, hour, total, ok_count, avg_ms)
          SELECT target_type, target_id, (ts / ${HOUR}) * ${HOUR}, count(*), sum(ok), avg(latency_ms)
          FROM checks WHERE ts < ? GROUP BY 1, 2, 3
          ON CONFLICT DO UPDATE SET total = total + excluded.total, ok_count = ok_count + excluded.ok_count`,
    args: [cutoff],
  })
  await db.delete(schema.checks).where(lt(schema.checks.ts, cutoff))
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date().toISOString()))
  await db.delete(schema.sentNotifications).where(lt(schema.sentNotifications.sentAt, new Date(Date.now() - 90 * DAY).toISOString()))
}

const safe = (name: string, fn: () => Promise<unknown>) => async () => {
  try {
    await fn()
  } catch (e) {
    console.error(`[cron:${name}]`, e)
  }
}

export function startScheduler() {
  const tz = { timezone: env.timezone, protect: true }
  new Cron("*/1 * * * *", tz, safe("checks", runChecks))
  new Cron("0 * * * *", tz, safe("hourly", async () => {
    const s = await getSettings()
    const h = tehranHour()
    if (h === s.reminderHour) await sendReminders()
    if (h === s.backupHour) await backupDatabase()
  }))
  new Cron("30 4 * * *", tz, safe("daily", async () => {
    await refreshAllDomains()
    await refreshServiceCerts()
    await compactChecks()
  }))
  // first pass shortly after boot
  setTimeout(safe("boot", async () => {
    await runChecks()
    await refreshAllDomains()
    await refreshServiceCerts()
  }), 5_000)
}
