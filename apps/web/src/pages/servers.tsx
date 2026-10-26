import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Archive, Cpu, HardDrive, MapPin, MemoryStick, Plus, Search, Server } from "lucide-react"
import type { ServerDTO } from "@serveryar/shared"
import { useProviders, useServers, useVendors } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { CYCLE_LABEL, daysText, daysUntil, faNum, money, uptimeText, urgencyClass } from "@/lib/format"
import { EmptyState, PageHeader, StatusDot, Stagger, StaggerItem } from "@/components/common"
import { ServerFormDialog } from "@/components/server-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

function ServerCard({ s, provider, vendor }: { s: ServerDTO; provider?: string; vendor?: string }) {
  const days = s.nextRenewal ? daysUntil(s.nextRenewal) : null
  return (
    <Link to={`/servers/${s.id}`} className="block h-full">
      <Card
        className={cn(
          "group h-full gap-3 px-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10",
          s.status === "down" && "border-danger/40",
          s.archived && "opacity-60",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusDot status={s.status} />
              <span className="truncate font-semibold">{s.name}</span>
              {s.archived && <Archive className="size-3.5 text-muted-foreground" />}
            </div>
            <div className="ltr mt-1 truncate text-start font-mono text-xs text-muted-foreground">{s.ips[0] ?? "بدون IP"}</div>
          </div>
          <div className="text-left">
            <div className="text-lg font-bold num">{uptimeText(s.uptime24h)}</div>
            <div className="text-[10px] text-muted-foreground">آپ‌تایم ۲۴ ساعت</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          {provider && <span className="rounded-md bg-muted px-2 py-0.5">{provider}</span>}
          {vendor && <span className="rounded-md bg-muted px-2 py-0.5">از {vendor}</span>}
          {s.location && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
              <MapPin className="size-3" />
              {s.location}
            </span>
          )}
          {s.tags.map((t) => (
            <span key={t} className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
              #{t}
            </span>
          ))}
        </div>

        {(s.cpu || s.ram || s.disk) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground" dir="ltr">
            {s.cpu && (
              <span className="inline-flex items-center gap-1">
                <Cpu className="size-3.5" />
                {s.cpu}
              </span>
            )}
            {s.ram && (
              <span className="inline-flex items-center gap-1">
                <MemoryStick className="size-3.5" />
                {s.ram}
              </span>
            )}
            {s.disk && (
              <span className="inline-flex items-center gap-1">
                <HardDrive className="size-3.5" />
                {s.disk}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between border-t border-border pt-3 text-xs">
          <div>
            <div className="text-muted-foreground">تمدید</div>
            <div className={cn("font-medium", days !== null && urgencyClass(days))}>{days === null ? "—" : daysText(days)}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">سرویس‌ها</div>
            <div className="font-medium">{faNum(s.serviceCount)}</div>
          </div>
          <div className="text-left">
            <div className="text-muted-foreground">{CYCLE_LABEL[s.billingCycle]}</div>
            <div className="font-medium">{s.price ? money(s.price, s.currency) : "—"}</div>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export default function ServersPage() {
  const [params, setParams] = useSearchParams()
  const { data, isLoading } = useServers()
  const providers = useProviders()
  const vendors = useVendors()
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState("active")
  const formOpen = params.get("new") === "1"

  const pName = useMemo(() => new Map(providers.data?.map((p) => [p.id, p.name])), [providers.data])
  const vName = useMemo(() => new Map(vendors.data?.map((p) => [p.id, p.name])), [vendors.data])

  const list = (data ?? []).filter((s) => {
    if (filter === "active" && s.archived) return false
    if (filter === "archived" && !s.archived) return false
    if (filter === "down" && s.status !== "down") return false
    if (!q) return true
    const hay = [s.name, ...s.ips, s.location, ...s.tags, s.providerId && pName.get(s.providerId)].join(" ").toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  return (
    <>
      <PageHeader
        title="سرورها"
        description={data ? `${faNum(data.filter((s) => !s.archived).length)} سرور فعال` : undefined}
        actions={
          <Button onClick={() => setParams({ new: "1" })}>
            <Plus />
            سرور جدید
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام، IP، تگ…" className="glass pr-9" />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="active">فعال</TabsTrigger>
            <TabsTrigger value="down">قطع</TabsTrigger>
            <TabsTrigger value="archived">بایگانی</TabsTrigger>
            <TabsTrigger value="all">همه</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Server />} title={data?.length ? "چیزی پیدا نشد" : "هنوز سروری ثبت نشده"}>
          {!data?.length && "با دکمهٔ «سرور جدید» شروع کن."}
        </EmptyState>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <StaggerItem key={s.id}>
              <ServerCard s={s} provider={s.providerId ? pName.get(s.providerId) : undefined} vendor={s.vendorId ? vName.get(s.vendorId) : undefined} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <ServerFormDialog open={formOpen} onOpenChange={(o) => setParams(o ? { new: "1" } : {})} />
    </>
  )
}
