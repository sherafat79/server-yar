import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Wallet } from "lucide-react"
import { CURRENCIES, type Currency } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction, useCosts, useMe, useMonthlyPayments, usePayments } from "@/lib/queries"
import { CURRENCY, faNum, jalali, money } from "@/lib/format"
import { EmptyState, PageHeader, Stagger, StaggerItem } from "@/components/common"
import { CountUp } from "@/components/count-up"
import { ConfirmDelete } from "@/components/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const barConfig = { total: { label: "پرداختی", color: "var(--chart-1)" } } satisfies ChartConfig

/** Jalali "YYYY/MM" label for a Gregorian YYYY-MM month (uses mid-month). */
const monthLabel = (m: string) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", month: "short", year: "2-digit" }).format(new Date(`${m}-15T12:00:00Z`))

export default function CostsPage() {
  const costs = useCosts()
  const monthly = useMonthlyPayments()
  const payments = usePayments()
  const me = useMe()
  const used = useMemo(() => {
    const s = new Set<string>([...Object.keys(costs.data?.monthly ?? {}), ...(monthly.data ?? []).map((r) => r.currency)])
    return CURRENCIES.filter((c) => s.has(c))
  }, [costs.data, monthly.data])
  const [cur, setCur] = useState<Currency | null>(null)
  const active = cur ?? used[0] ?? "USD"
  const series = (monthly.data ?? []).filter((r) => r.currency === active).slice(-12).map((r) => ({ ...r, label: monthLabel(r.month) }))
  const delPayment = useAction((id: number) => api(`/payments/${id}`, { method: "DELETE" }), "پرداخت حذف شد")

  if (costs.data && used.length === 0 && !payments.data?.length) {
    return (
      <>
        <PageHeader title="هزینه‌ها" />
        <EmptyState icon={<Wallet />} title="هنوز هزینه‌ای ثبت نشده">
          برای سرورها و دامنه‌ها قیمت وارد کن تا اینجا پر شود.
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader title="هزینه‌ها" description="هر ارز جدا محاسبه می‌شود — بدون تبدیل نرخ" />
      <Stagger className="mb-4 grid gap-4 sm:grid-cols-3">
        {used.map((c) => (
          <StaggerItem key={c}>
            <Card className="px-5">
              <div className="text-xs text-muted-foreground">{CURRENCY[c].label} — ماهانه</div>
              <div className="text-3xl font-bold">
                <CountUp value={costs.data?.monthly[c] ?? 0} digits={CURRENCY[c].digits} />
              </div>
              <div className="text-xs text-muted-foreground">سالانه ≈ {money(costs.data?.yearly[c] ?? 0, c)}</div>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>پرداخت‌های واقعی ماه به ماه</CardTitle>
            <CardDescription>از روی دکمه‌های «تمدید شد»</CardDescription>
            {used.length > 1 && (
              <CardAction>
                <Tabs value={active} onValueChange={(v) => setCur(v as Currency)}>
                  <TabsList>
                    {used.map((c) => (
                      <TabsTrigger key={c} value={c}>
                        {CURRENCY[c].label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {series.length === 0 ? (
              <p className="py-20 text-center text-sm text-muted-foreground">پرداختی با این ارز ثبت نشده</p>
            ) : (
              <ChartContainer config={barConfig} className="aspect-auto h-64 w-full">
                <BarChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" reversed tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => money(Number(v), active)} />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>به تفکیک پروایدر (ماهانه)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {costs.data?.byProvider.map((p) => (
              <div key={`${p.provider}${p.currency}`} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span>{p.provider}</span>
                <span className="font-medium">{money(p.monthly, p.currency as Currency)}</span>
              </div>
            ))}
            {!costs.data?.byProvider.length && <p className="py-10 text-center text-sm text-muted-foreground">—</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>تاریخچهٔ پرداخت‌ها ({faNum(payments.data?.length ?? 0)})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">تاریخ</TableHead>
                <TableHead className="text-start">مورد</TableHead>
                <TableHead className="text-start">مبلغ</TableHead>
                <TableHead className="hidden text-start md:table-cell">دوره</TableHead>
                <TableHead className="hidden text-start md:table-cell">ثبت توسط</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{jalali(p.paidAt)}</TableCell>
                  <TableCell>
                    {p.targetType === "server" ? "🖥" : "🌐"} {p.targetName}
                    {p.note && <span className="text-xs text-muted-foreground"> · {p.note}</span>}
                  </TableCell>
                  <TableCell className="font-medium">{money(p.amount, p.currency)}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {p.periodFrom && p.periodTo ? `${jalali(p.periodFrom)} ← ${jalali(p.periodTo)}` : "—"}
                  </TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{p.userName ?? "خودکار"}</TableCell>
                  <TableCell>{me.data?.role === "admin" && <ConfirmDelete what="این پرداخت" onConfirm={() => delPayment.mutateAsync(p.id)} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
