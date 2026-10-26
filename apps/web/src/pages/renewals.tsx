import { useMemo, useState } from "react"
import { Link } from "react-router"
import { ChevronLeft, ChevronRight, Globe, Server } from "lucide-react"
import { DateObject } from "react-multi-date-picker"
import persian from "react-date-object/calendars/persian"
import persian_fa from "react-date-object/locales/persian_fa"
import type { Currency, RenewalItem } from "@serveryar/shared"
import { useRenewals } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { CURRENCY, daysText, faNum, gregorian, jalali, money, todayIso, urgencyClass } from "@/lib/format"
import { PageHeader } from "@/components/common"
import { RenewButton } from "@/components/renew-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"]

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function MonthCalendar({ items }: { items: RenewalItem[] }) {
  const [offset, setOffset] = useState(0)
  const byDate = useMemo(() => {
    const m = new Map<string, RenewalItem[]>()
    for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i])
    return m
  }, [items])

  const month = new DateObject({ calendar: persian, locale: persian_fa }).toFirstOfMonth().add(offset, "month")
  const first = new DateObject(month).toFirstOfMonth()
  const lead = first.weekDay.index // 0 = Saturday in the Persian calendar
  const length = first.month.length
  const today = todayIso()
  const cells: (DateObject | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length }, (_, i) => new DateObject(first).add(i, "day"))]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{month.format("MMMM YYYY")}</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setOffset((o) => o - 1)} aria-label="ماه قبل">
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
            امروز
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setOffset((o) => o + 1)} aria-label="ماه بعد">
            <ChevronLeft />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={`e${i}`} />
            const key = iso(c.toDate())
            const list = byDate.get(key) ?? []
            const isToday = key === today
            return (
              <div
                key={key}
                className={cn(
                  "min-h-20 rounded-lg border border-transparent p-1.5 text-start transition-colors",
                  list.length ? "bg-accent/40" : "bg-muted/20",
                  isToday && "border-primary/60",
                )}
              >
                <div className={cn("text-xs", isToday ? "font-bold text-primary" : "text-muted-foreground")}>{c.format("D")}</div>
                <div className="mt-1 grid gap-0.5">
                  {list.slice(0, 3).map((r) => (
                    <Link
                      key={`${r.type}${r.id}`}
                      to={r.type === "server" ? `/servers/${r.id}` : "/domains"}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                        r.daysLeft < 0 || r.daysLeft <= 3 ? "bg-danger/20 text-danger" : r.daysLeft <= 7 ? "bg-warning/20 text-warning" : "bg-primary/15 text-primary",
                      )}
                      title={r.name}
                    >
                      {r.name}
                    </Link>
                  ))}
                  {list.length > 3 && <span className="text-[10px] text-muted-foreground">+{faNum(list.length - 3)}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function RenewalsPage() {
  const { data, isLoading } = useRenewals()
  if (isLoading || !data) return <Skeleton className="h-96 rounded-2xl" />

  const next30 = data.filter((r) => r.daysLeft <= 30)
  const totals: Partial<Record<Currency, number>> = {}
  for (const r of next30) if (r.price) totals[r.currency] = (totals[r.currency] ?? 0) + r.price

  return (
    <>
      <PageHeader title="تمدیدها" description="یادآوری ۷، ۳ و ۱ روز قبل و روز سررسید، ساعت ۱۰ صبح در کانال تلگرام" />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <MonthCalendar items={data} />
        </div>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>۳۰ روز آینده: {faNum(next30.length)} مورد</CardTitle>
            <CardDescription>
              {Object.keys(totals).length
                ? (Object.entries(totals) as [Currency, number][]).map(([c, v]) => money(v, c)).join(" + ")
                : "هزینه‌ای در راه نیست"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid max-h-[640px] gap-2 overflow-y-auto">
            {data.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">هیچ سررسیدی ثبت نشده</p>}
            {data.map((r) => (
              <div key={`${r.type}${r.id}`} className="flex items-center gap-3 rounded-xl border border-glass-border bg-background/20 p-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  {r.type === "server" ? <Server className="size-4" /> : <Globe className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={r.type === "server" ? `/servers/${r.id}` : "/domains"} className="block truncate text-sm font-medium hover:underline">
                    {r.name}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">
                    {jalali(r.date)} · {gregorian(r.date)}
                    {r.price ? ` · ${money(r.price, r.currency)}` : ""}
                    {r.autoRenew && " · 🔁"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={cn("text-xs font-semibold", urgencyClass(r.daysLeft))}>{daysText(r.daysLeft)}</span>
                  <RenewButton kind={r.type === "server" ? "servers" : "domains"} id={r.id} name={r.name} price={r.price} currency={r.currency} due={r.date} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">ارزها: {Object.values(CURRENCY).map((c) => c.label).join("، ")} — هر کدام جدا جمع زده می‌شوند</p>
    </>
  )
}
