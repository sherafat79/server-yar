import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ArrowRight, ExternalLink, KeyRound, Pencil, Plus, Terminal } from "lucide-react"
import type { PaymentDTO } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction, useChecks, useIncidents, useMe, useProviders, useServer, useServices, useVendors } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { CYCLE_LABEL, daysText, daysUntil, duration, gregorian, jalali, jalaliDateTime, money, timeAgo, uptimeText, urgencyClass } from "@/lib/format"
import { StatusPill, Stagger, StaggerItem, UptimeBars } from "@/components/common"
import { ConfirmDelete, CopyText, MaintenanceMenu, RevealSecret } from "@/components/forms"
import { RenewButton } from "@/components/renew-dialog"
import { ServerFormDialog } from "@/components/server-form"
import { ServiceCard } from "@/components/service-list"
import { ServiceFormDialog } from "@/components/service-form"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const latencyConfig = { ms: { label: "تأخیر (ms)", color: "var(--chart-2)" } } satisfies ChartConfig

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-left break-words">{children ?? "—"}</span>
    </div>
  )
}

export default function ServerDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: s, isLoading } = useServer(id)
  const me = useMe()
  const [range, setRange] = useState("24h")
  const checks = useChecks("servers", id, range)
  const services = useServices({ serverId: id })
  const incidents = useIncidents({ type: "server", id })
  const providers = useProviders()
  const vendors = useVendors()
  const payments = useQuery({ queryKey: ["payments", "server", id], queryFn: () => api<PaymentDTO[]>(`/servers/${id}/payments`) })
  const [edit, setEdit] = useState(false)
  const [addService, setAddService] = useState(false)
  const del = useAction(() => api(`/servers/${id}`, { method: "DELETE" }), "سرور حذف شد")

  if (isLoading || !s) return <Skeleton className="h-96 rounded-2xl" />

  const days = s.nextRenewal ? daysUntil(s.nextRenewal) : null
  const provider = providers.data?.find((p) => p.id === s.providerId)?.name
  const vendor = vendors.data?.find((p) => p.id === s.vendorId)?.name
  const canReveal = me.data?.canRevealSecrets
  const ip = s.ips[0]
  const sshCmd = ip ? `ssh ${s.sshUser || "root"}@${ip}${s.sshPort && s.sshPort !== 22 ? ` -p ${s.sshPort}` : ""}` : null

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/servers" aria-label="بازگشت">
              <ArrowRight />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{s.name}</h1>
              <StatusPill status={s.status} />
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              آخرین چک {timeAgo(s.lastCheckedAt)}
              {s.latencyMs !== null && <span className="ltr num"> · {s.latencyMs}ms</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <MaintenanceMenu kind="servers" id={s.id} until={s.maintenanceUntil} />
          <RenewButton kind="servers" id={s.id} name={s.name} price={s.price ?? null} currency={s.currency} due={s.nextRenewal ?? null} />
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            <Pencil />
            ویرایش
          </Button>
          <ConfirmDelete
            what={`سرور «${s.name}»`}
            onConfirm={async () => {
              await del.mutateAsync(undefined)
              navigate("/servers")
            }}
          />
        </div>
      </div>

      <Stagger className="grid gap-4 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>
                آپ‌تایم {range === "24h" ? "۲۴ ساعت" : range === "7d" ? "۷ روز" : "۳۰ روز"}:{" "}
                {uptimeText(range === "24h" ? s.uptime24h : range === "7d" ? s.uptime7d : s.uptime30d)}
              </CardTitle>
              <CardDescription>ping و در صورت بسته بودن ICMP، پورت SSH</CardDescription>
              <CardAction>
                <Tabs value={range} onValueChange={setRange}>
                  <TabsList>
                    <TabsTrigger value="24h">۲۴س</TabsTrigger>
                    <TabsTrigger value="7d">۷ر</TabsTrigger>
                    <TabsTrigger value="30d">۳۰ر</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              <UptimeBars points={checks.data ?? []} />
              <ChartContainer config={latencyConfig} className="aspect-auto h-40 w-full">
                <AreaChart data={checks.data ?? []} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillMs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-ms)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--color-ms)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="t" reversed tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(v) => (range === "24h" ? new Date(v).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : jalali(v, "short"))} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => jalaliDateTime(String(p?.[0]?.payload?.t ?? ""))} />} />
                  <Area dataKey="ms" type="monotone" stroke="var(--color-ms)" strokeWidth={2} fill="url(#fillMs)" connectNulls />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className={cn(days !== null && urgencyClass(days))}>{days === null ? "سررسید ثبت نشده" : `تمدید ${daysText(days)}`}</CardTitle>
              <CardDescription>{s.autoRenew ? "🔁 تمدید خودکار فعال" : "تمدید دستی"}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <Row label="سررسید">{s.nextRenewal ? `${jalali(s.nextRenewal)} · ${gregorian(s.nextRenewal)}` : null}</Row>
              <Row label="هزینه">{s.price ? `${money(s.price, s.currency)} / ${CYCLE_LABEL[s.billingCycle]}` : null}</Row>
              <Row label="پروایدر">{provider}</Row>
              <Row label="فروشنده">{vendor}</Row>
              <div className="pt-3">
                <div className="mb-2 text-xs text-muted-foreground">آخرین پرداخت‌ها</div>
                {payments.data?.length ? (
                  <div className="grid gap-1.5">
                    {payments.data.slice(0, 4).map((p) => (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span>{jalali(p.paidAt)}</span>
                        <span className="font-medium">{money(p.amount, p.currency)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">پرداختی ثبت نشده</div>
                )}
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>مشخصات</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <Row label="IP">
                <div className="flex flex-col items-end">
                  {s.ips.length ? s.ips.map((i) => <CopyText key={i} text={i} />) : "—"}
                </div>
              </Row>
              <Row label="لوکیشن">{s.location}</Row>
              <Row label="سیستم‌عامل">{s.os && <span dir="ltr">{s.os}</span>}</Row>
              <Row label="CPU">{s.cpu && <span dir="ltr">{s.cpu}</span>}</Row>
              <Row label="RAM">{s.ram && <span dir="ltr">{s.ram}</span>}</Row>
              <Row label="دیسک">{s.disk && <span dir="ltr">{s.disk}</span>}</Row>
              <Row label="ترافیک">{s.traffic && <span dir="ltr">{s.traffic}</span>}</Row>
              {s.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3">
                  {s.tags.map((t) => (
                    <span key={t} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" />
                دسترسی
              </CardTitle>
              {!canReveal && <CardDescription>مشاهدهٔ رمزها برای حساب تو غیرفعال است</CardDescription>}
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {sshCmd && (
                <div className="flex items-center gap-2 pb-3">
                  <Terminal className="size-4 text-muted-foreground" />
                  <CopyText text={sshCmd} className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-start font-mono text-xs hover:bg-accent" />
                </div>
              )}
              <Row label="رمز SSH">{s.hasSshPassword ? canReveal ? <RevealSecret serverId={s.id} field="sshPassword" /> : "••••" : null}</Row>
              <Row label="کلید SSH">{s.hasSshKey ? canReveal ? <RevealSecret serverId={s.id} field="sshKey" /> : "••••" : null}</Row>
              <Row label="پنل">
                {s.panelUrl ? (
                  <a href={s.panelUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                    باز کردن <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </Row>
              <Row label="کاربر پنل">{s.panelUser && <CopyText text={s.panelUser} />}</Row>
              <Row label="رمز پنل">{s.hasPanelPassword ? canReveal ? <RevealSecret serverId={s.id} field="panelPassword" /> : "••••" : null}</Row>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>رخدادها</CardTitle>
              <CardDescription>آخرین قطعی‌های این سرور</CardDescription>
            </CardHeader>
            <CardContent className="grid max-h-72 gap-2 overflow-y-auto">
              {incidents.data?.length ? (
                incidents.data.map((i) => (
                  <div key={i.id} className="flex items-start gap-2 text-sm">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i.resolvedAt ? "bg-success" : "bg-danger")} />
                    <div>
                      <div>{jalaliDateTime(i.startedAt)}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.resolvedAt ? `مدت: ${duration(Date.parse(i.resolvedAt) - Date.parse(i.startedAt))}` : "هنوز قطع"} {i.cause && `· ${i.cause}`}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">بدون قطعی ✨</p>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </Stagger>

      {s.notes && (
        <Card>
          <CardHeader>
            <CardTitle>یادداشت</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line">{s.notes}</CardContent>
        </Card>
      )}

      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">سرویس‌های این سرور</h2>
        <Button size="sm" onClick={() => setAddService(true)}>
          <Plus />
          سرویس جدید
        </Button>
      </div>
      {services.data?.length ? (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.data.map((svc) => (
            <StaggerItem key={svc.id}>
              <ServiceCard s={svc} />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <p className="glass rounded-2xl py-10 text-center text-sm text-muted-foreground">هنوز سرویسی روی این سرور ثبت نشده</p>
      )}

      <ServerFormDialog open={edit} onOpenChange={setEdit} server={s} />
      <ServiceFormDialog open={addService} onOpenChange={setAddService} defaults={{ serverId: s.id }} />
    </div>
  )
}
