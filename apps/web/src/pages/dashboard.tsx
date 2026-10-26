import { Link } from "react-router"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { AlertTriangle, ArrowLeft, Boxes, CalendarClock, CheckCircle2, Globe, Server, Wallet } from "lucide-react"
import type { Currency, DashboardDTO, RenewalItem } from "@serveryar/shared"
import { useDashboard } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { CURRENCY, daysText, duration, faNum, jalali, money, SERVICE_TYPE_LABEL, timeAgo, urgencyClass } from "@/lib/format"
import { EmptyState, StatusDot, Stagger, StaggerItem } from "@/components/common"
import { CountUp } from "@/components/count-up"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

function Ring({ value, total, tone }: { value: number; total: number; tone: string }) {
  const pct = total ? value / total : 0
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className={cn("transition-[stroke-dashoffset] duration-1000 ease-out", tone)}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
      />
    </svg>
  )
}

function Kpis({ d }: { d: DashboardDTO }) {
  const down = d.servers.down + d.services.down
  const currencies = (Object.keys(d.monthlyCost) as Currency[]).sort()
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StaggerItem>
        <Card className="h-full flex-row items-center justify-between px-5">
          <div>
            <div className="text-xs text-muted-foreground">سرورهای آنلاین</div>
            <div className="mt-1 text-3xl font-bold">
              <CountUp value={d.servers.up} />
              <span className="text-lg font-normal text-muted-foreground"> / {faNum(d.servers.total)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {d.servers.maintenance ? `${faNum(d.servers.maintenance)} در تعمیرات` : "مانیتورینگ زنده"}
            </div>
          </div>
          <Ring value={d.servers.up} total={d.servers.total} tone="stroke-success" />
        </Card>
      </StaggerItem>
      <StaggerItem>
        <Card className={cn("h-full flex-row items-center justify-between px-5", down > 0 && "border-danger/40 bg-danger/[0.06]")}>
          <div>
            <div className="text-xs text-muted-foreground">{down > 0 ? "موارد قطع" : "وضعیت سرویس‌ها"}</div>
            <div className={cn("mt-1 text-3xl font-bold", down > 0 && "text-danger")}>
              {down > 0 ? <CountUp value={down} /> : "همه سالم"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {faNum(d.services.up)} از {faNum(d.services.total)} سرویس آنلاین
            </div>
          </div>
          <div className={cn("grid size-12 place-items-center rounded-2xl", down > 0 ? "bg-danger/15 text-danger" : "bg-success/15 text-success")}>
            {down > 0 ? <AlertTriangle /> : <CheckCircle2 />}
          </div>
        </Card>
      </StaggerItem>
      <StaggerItem>
        <Card className="h-full flex-row items-center justify-between px-5">
          <div>
            <div className="text-xs text-muted-foreground">تمدید در ۳۰ روز آینده</div>
            <div className="mt-1 text-3xl font-bold">
              <CountUp value={d.renewals30d} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {d.upcoming[0] ? `نزدیک‌ترین: ${d.upcoming[0].name} · ${daysText(d.upcoming[0].daysLeft)}` : "چیزی در راه نیست"}
            </div>
          </div>
          <div className="grid size-12 place-items-center rounded-2xl bg-warning/15 text-warning">
            <CalendarClock />
          </div>
        </Card>
      </StaggerItem>
      <StaggerItem>
        <Card className="h-full flex-row items-center justify-between px-5">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">هزینهٔ ماهانه</div>
            {currencies.length === 0 ? (
              <div className="mt-1 text-3xl font-bold">—</div>
            ) : (
              <div className="mt-1 grid gap-0.5">
                {currencies.map((c) => (
                  <div key={c} className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold">
                      <CountUp value={d.monthlyCost[c]!} digits={CURRENCY[c].digits} />
                    </span>
                    <span className="text-xs text-muted-foreground">{CURRENCY[c].label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Wallet />
          </div>
        </Card>
      </StaggerItem>
    </Stagger>
  )
}

function RenewalRow({ r }: { r: RenewalItem }) {
  const pct = Math.max(0, Math.min(1, 1 - r.daysLeft / 60))
  const bar = r.daysLeft <= 3 ? "bg-danger" : r.daysLeft <= 7 ? "bg-warning" : "bg-primary"
  return (
    <Link
      to={r.type === "server" ? `/servers/${r.id}` : "/domains"}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent/50"
    >
      <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
        {r.type === "server" ? <Server className="size-4" /> : <Globe className="size-4" />}
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{r.name}</span>
          <span className={cn("shrink-0 text-xs font-medium", urgencyClass(r.daysLeft))}>{daysText(r.daysLeft)}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-[width] duration-1000", bar)} style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
      <div className="hidden w-28 text-left text-xs text-muted-foreground sm:block">
        <div>{jalali(r.date)}</div>
        {r.price ? <div className="mt-0.5">{money(r.price, r.currency)}</div> : null}
      </div>
    </Link>
  )
}

const uptimeConfig = { uptime: { label: "آپ‌تایم", color: "var(--chart-1)" } } satisfies ChartConfig

export function DashboardPage() {
  const { data: d, isLoading } = useDashboard()

  if (isLoading || !d) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  if (d.servers.total === 0 && d.services.total === 0) {
    return (
      <EmptyState icon={<Server />} title="به سرور یار خوش آمدی">
        اول یک سرور اضافه کن؛ بعد سرویس‌ها و دامنه‌ها را رویش ثبت کن.
        <div className="mt-4">
          <Button asChild>
            <Link to="/servers?new=1">افزودن اولین سرور</Link>
          </Button>
        </div>
      </EmptyState>
    )
  }

  const downServices = d.liveServices.filter((s) => s.status === "down")
  const avgUptime = d.uptimeSeries.filter((p) => p.uptime !== null)
  const weekUptime = avgUptime.length ? avgUptime.reduce((a, p) => a + p.uptime!, 0) / avgUptime.length : null
  // one bar per provider; providers billed in several currencies show the largest
  const providerBars = d.costByProvider.slice(0, 6).map((p) => ({ ...p, label: `${p.provider} (${CURRENCY[p.currency as Currency].label})` }))

  return (
    <div className="grid gap-4">
      <Kpis d={d} />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>{d.upcoming.length ? `${faNum(d.upcoming.length)} تمدید در ۶۰ روز آینده` : "تا ۶۰ روز آینده تمدیدی نداری"}</CardTitle>
            <CardDescription>مرتب‌شده بر اساس نزدیکی سررسید</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/renewals">
                  همه
                  <ArrowLeft />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid max-h-[360px] gap-0.5 overflow-y-auto">
            {d.upcoming.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">🎉 خیالت راحت</p>}
            {d.upcoming.map((r) => (
              <RenewalRow key={`${r.type}-${r.id}`} r={r} />
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{downServices.length ? `${faNum(downServices.length)} سرویس قطع است` : "همهٔ سرویس‌ها در دسترس‌اند"}</CardTitle>
            <CardDescription>وضعیت زنده · به‌روزرسانی خودکار</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/services">
                  همه
                  <ArrowLeft />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {d.liveServices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">هنوز سرویسی با چک سلامت ثبت نشده</p>
            ) : (
              <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {[...d.liveServices]
                  .sort((a, b) => Number(b.status === "down") - Number(a.status === "down"))
                  .map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border border-glass-border bg-background/30 px-3 py-2.5",
                        s.status === "down" && "border-danger/40 bg-danger/10",
                      )}
                    >
                      <StatusDot status={s.status} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{s.hostname ?? SERVICE_TYPE_LABEL[s.type]}</div>
                      </div>
                      {s.latencyMs !== null && <span className="ltr text-[11px] text-muted-foreground num">{s.latencyMs}ms</span>}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>آپ‌تایم ۷ روز: {weekUptime === null ? "—" : `${faNum(weekUptime, 2)}٪`}</CardTitle>
            <CardDescription>میانگین روزانهٔ همهٔ سرورها و سرویس‌ها</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={uptimeConfig} className="aspect-auto h-48 w-full">
              <AreaChart data={d.uptimeSeries} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillUptime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-uptime)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-uptime)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => jalali(v, "short").split("/").slice(1).join("/")} reversed />
                <YAxis domain={[(min: number) => Math.max(0, Math.floor(min - 1)), 100]} hide />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => jalali(String(v))} formatter={(v) => `${faNum(Number(v), 2)}٪`} />} />
                <Area dataKey="uptime" type="monotone" stroke="var(--color-uptime)" strokeWidth={2} fill="url(#fillUptime)" connectNulls />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>هزینهٔ ماهانه به تفکیک پروایدر</CardTitle>
            <CardDescription>هر ارز جدا · بدون تبدیل</CardDescription>
          </CardHeader>
          <CardContent>
            {providerBars.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">قیمتی ثبت نشده</p>
            ) : (
              <div className="grid gap-3">
                {providerBars.map((p) => {
                  const max = Math.max(...providerBars.filter((x) => x.currency === p.currency).map((x) => x.monthly))
                  return (
                    <div key={p.label} className="grid gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate">{p.provider}</span>
                        <span className="text-muted-foreground">{money(p.monthly, p.currency as Currency)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-chart-1 to-chart-2 transition-[width] duration-1000"
                          style={{ width: `${(p.monthly / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>آخرین رخدادها</CardTitle>
            <CardDescription>قطعی‌ها و بازگشت‌ها</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/events">
                  همه
                  <ArrowLeft />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-2">
            {d.recentIncidents.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">رخدادی ثبت نشده ✨</p>}
            {d.recentIncidents.map((i) => (
              <div key={i.id} className="flex items-start gap-3 rounded-lg px-1 py-1.5">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i.resolvedAt ? "bg-success" : "bg-danger")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm">
                    {i.targetType === "server" ? <Server className="size-3.5 text-muted-foreground" /> : <Boxes className="size-3.5 text-muted-foreground" />}
                    <span className="truncate font-medium">{i.targetName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {timeAgo(i.startedAt)} ·{" "}
                    {i.resolvedAt ? `قطعی ${duration(Date.parse(i.resolvedAt) - Date.parse(i.startedAt))}` : <span className="text-danger">هنوز قطع</span>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
