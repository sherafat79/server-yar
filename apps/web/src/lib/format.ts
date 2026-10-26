import type { BillingCycle, Currency, ServiceType, Status } from "@serveryar/shared"

const TZ = "Asia/Tehran"

const asDate = (d: string | Date) => (typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d)

export const jalali = (d: string | Date, style: "medium" | "long" | "short" = "medium") =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: TZ, dateStyle: style }).format(asDate(d))

export const gregorian = (d: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(asDate(d))

export const jalaliDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(asDate(d))

export const faNum = (n: number, digits = 0) =>
  n.toLocaleString("fa-IR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })

export function timeAgo(d: string | null | undefined): string {
  if (!d) return "—"
  const s = Math.round((Date.now() - Date.parse(d)) / 1000)
  if (s < 60) return "همین الان"
  const m = Math.round(s / 60)
  if (m < 60) return `${faNum(m)} دقیقه پیش`
  const h = Math.round(m / 60)
  if (h < 24) return `${faNum(h)} ساعت پیش`
  return `${faNum(Math.round(h / 24))} روز پیش`
}

export function duration(ms: number): string {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${faNum(m)} دقیقه`
  const h = Math.floor(m / 60)
  if (h < 24) return `${faNum(h)} ساعت${m % 60 ? ` و ${faNum(m % 60)} دقیقه` : ""}`
  return `${faNum(Math.floor(h / 24))} روز${h % 24 ? ` و ${faNum(h % 24)} ساعت` : ""}`
}

export const daysText = (d: number) =>
  d === 0 ? "امروز" : d < 0 ? `${faNum(-d)} روز گذشته` : d === 1 ? "فردا" : `${faNum(d)} روز دیگر`

/** Local today as YYYY-MM-DD (Tehran). */
export const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date())

export function daysUntil(date: string): number {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  const [ty, tm, td] = todayIso().split("-").map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000)
}

export const CURRENCY: Record<Currency, { label: string; symbol: string; digits: number }> = {
  IRT: { label: "تومان", symbol: "تومان", digits: 0 },
  TRY: { label: "لیر", symbol: "₺", digits: 2 },
  USD: { label: "دلار", symbol: "$", digits: 2 },
}

export function money(amount: number, currency: Currency): string {
  const c = CURRENCY[currency]
  const n = amount.toLocaleString("fa-IR", { maximumFractionDigits: c.digits })
  return currency === "IRT" ? `${n} تومان` : `${c.symbol}${n}`
}

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "ماهانه",
  quarterly: "سه‌ماهه",
  semiannual: "شش‌ماهه",
  yearly: "سالانه",
}

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  telegram_bot: "ربات تلگرام",
  website: "وب‌سایت",
  api: "API",
  database: "دیتابیس",
  worker: "Cron / Worker",
  panel: "پنل",
  other: "سایر",
}

export const STATUS_LABEL: Record<Status, string> = {
  up: "آنلاین",
  down: "قطع",
  pending: "در انتظار",
  maintenance: "تعمیرات",
  unknown: "نامشخص",
}

export const uptimeText = (v: number | null) => (v === null ? "—" : `${faNum(v, v === 100 ? 0 : 2)}٪`)

export const urgencyClass = (days: number) =>
  days < 0 ? "text-danger" : days <= 3 ? "text-danger" : days <= 7 ? "text-warning" : days <= 30 ? "text-foreground" : "text-muted-foreground"
