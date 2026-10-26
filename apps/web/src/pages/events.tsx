import { Boxes, Eye, LogIn, Pencil, Plus, RefreshCcw, Server, Settings, Trash2, Wrench } from "lucide-react"
import { useActivity, useIncidents } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { duration, jalaliDateTime, timeAgo } from "@/lib/format"
import { PageHeader } from "@/components/common"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ACTION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  renew: RefreshCcw,
  reveal: Eye,
  login: LogIn,
  maintenance: Wrench,
  settings: Settings,
}

export default function EventsPage() {
  const incidents = useIncidents()
  const activity = useActivity()
  return (
    <>
      <PageHeader title="رخدادها و لاگ" description="قطعی‌ها و هر تغییری که در پنل انجام شده" />
      <Tabs defaultValue="incidents">
        <TabsList className="mb-4">
          <TabsTrigger value="incidents">قطعی‌ها</TabsTrigger>
          <TabsTrigger value="activity">لاگ فعالیت</TabsTrigger>
        </TabsList>
        <TabsContent value="incidents">
          <Card>
            <CardContent className="grid gap-1">
              {incidents.data?.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">هیچ قطعی‌ای ثبت نشده ✨</p>}
              {incidents.data?.map((i) => (
                <div key={i.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-accent/30">
                  <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", i.resolvedAt ? "bg-success" : "animate-pulse bg-danger")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {i.targetType === "server" ? <Server className="size-3.5" /> : <Boxes className="size-3.5" />}
                      {i.targetName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {jalaliDateTime(i.startedAt)} ·{" "}
                      {i.resolvedAt ? `قطعی ${duration(Date.parse(i.resolvedAt) - Date.parse(i.startedAt))}` : <span className="text-danger">ادامه دارد ({timeAgo(i.startedAt)})</span>}
                    </div>
                    {i.cause && <div className="ltr mt-1 truncate text-start font-mono text-[11px] text-muted-foreground">{i.cause}</div>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardContent className="relative grid gap-0">
              {activity.data?.map((a) => {
                const Icon = ACTION_ICON[a.action] ?? Pencil
                return (
                  <div key={a.id} className="flex items-start gap-3 border-b border-border px-1 py-2.5 last:border-0">
                    <div className={cn("grid size-7 shrink-0 place-items-center rounded-full bg-muted", a.action === "delete" && "text-danger", a.action === "reveal" && "text-warning")}>
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <div>{a.summary}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.userName ?? "سیستم"} · {jalaliDateTime(a.createdAt)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
