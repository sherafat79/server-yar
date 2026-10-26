import { env } from "../env.ts"

const DAY = 86_400_000

/** Today's date (YYYY-MM-DD) in Tehran time. */
export function todayTehran(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: env.timezone }).format(now)
}

export function tehranHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: env.timezone, hour: "numeric", hourCycle: "h23" }).format(now))
}

const toUtc = (d: string) => {
  const [y, m, day] = d.split("-").map(Number)
  return Date.UTC(y!, m! - 1, day!)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY)
}

export const daysLeft = (date: string) => daysBetween(todayTehran(), date)

/** Add months to a YYYY-MM-DD date, clamping to the end of month (Jan 31 + 1m = Feb 28). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const target = new Date(Date.UTC(y!, m! - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d!, lastDay))
  return target.toISOString().slice(0, 10)
}

export function formatJalali(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date.length === 10 ? `${date}T12:00:00Z` : date) : date
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: env.timezone, dateStyle: "medium" }).format(d)
}

export function formatDuration(ms: number): string {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} دقیقه`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ساعت و ${m % 60} دقیقه`
  return `${Math.floor(h / 24)} روز و ${h % 24} ساعت`
}

export const nowIso = () => new Date().toISOString()
