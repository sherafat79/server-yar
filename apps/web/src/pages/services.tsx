import { useMemo, useState } from "react"
import { Boxes, Plus, Search } from "lucide-react"
import { SERVICE_TYPES, type ServiceType } from "@serveryar/shared"
import { useServers, useServices } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { faNum, SERVICE_TYPE_LABEL } from "@/lib/format"
import { EmptyState, PageHeader, Stagger, StaggerItem } from "@/components/common"
import { SERVICE_ICON, ServiceCard } from "@/components/service-list"
import { ServiceFormDialog } from "@/components/service-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

export default function ServicesPage() {
  const { data, isLoading } = useServices()
  const servers = useServers()
  const [q, setQ] = useState("")
  const [type, setType] = useState<ServiceType | "all">("all")
  const [onlyDown, setOnlyDown] = useState(false)
  const [open, setOpen] = useState(false)
  const sName = useMemo(() => new Map(servers.data?.map((s) => [s.id, s.name])), [servers.data])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of data ?? []) m.set(s.type, (m.get(s.type) ?? 0) + 1)
    return m
  }, [data])

  const list = (data ?? [])
    .filter((s) => (type === "all" || s.type === type) && (!onlyDown || s.status === "down"))
    .filter((s) => !q || [s.name, s.hostname, s.path, ...s.tags, s.serverId && sName.get(s.serverId)].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.status === "down") - Number(a.status === "down"))
  const downCount = data?.filter((s) => s.status === "down").length ?? 0

  return (
    <>
      <PageHeader
        title="سرویس‌ها"
        description={data ? `${faNum(data.length)} سرویس روی ${faNum(servers.data?.length ?? 0)} سرور` : undefined}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            سرویس جدید
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو…" className="glass pr-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={type === "all"} onClick={() => setType("all")}>
            همه
          </Chip>
          {SERVICE_TYPES.filter((t) => counts.get(t)).map((t) => {
            const Icon = SERVICE_ICON[t]
            return (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>
                <Icon className="size-3.5" />
                {SERVICE_TYPE_LABEL[t]} <span className="opacity-60">{faNum(counts.get(t)!)}</span>
              </Chip>
            )
          })}
          {downCount > 0 && (
            <Chip active={onlyDown} onClick={() => setOnlyDown(!onlyDown)} danger>
              قطع‌ها {faNum(downCount)}
            </Chip>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Boxes />} title={data?.length ? "چیزی پیدا نشد" : "هنوز سرویسی ثبت نشده"}>
          ربات تلگرام، وب‌سایت، API و… را اینجا ثبت کن تا آپ‌تایمشان پایش شود.
        </EmptyState>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <StaggerItem key={s.id}>
              <ServiceCard s={s} serverName={s.serverId ? sName.get(s.serverId) : undefined} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
      <ServiceFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function Chip({ active, onClick, children, danger }: { active: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? danger
            ? "border-danger/50 bg-danger/15 text-danger"
            : "border-primary/40 bg-primary/15 text-foreground"
          : "glass text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
