import { useState } from "react"
import { Bot, Database, Globe, LayoutPanelLeft, Pencil, Server, Timer, Webhook, Box, HeartPulse, Copy } from "lucide-react"
import { toast } from "sonner"
import type { ServiceDTO, ServiceType } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction, useChecks } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { SERVICE_TYPE_LABEL, timeAgo, uptimeText } from "@/lib/format"
import { StatusPill, UptimeBars } from "@/components/common"
import { ConfirmDelete, MaintenanceMenu } from "@/components/forms"
import { ServiceFormDialog } from "@/components/service-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const SERVICE_ICON: Record<ServiceType, React.ComponentType<{ className?: string }>> = {
  telegram_bot: Bot,
  website: Globe,
  api: Webhook,
  database: Database,
  worker: Timer,
  panel: LayoutPanelLeft,
  other: Box,
}

function HeartbeatUrl({ token }: { token: string }) {
  const url = `${window.location.origin}/hb/${token}`
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
      <HeartPulse className="size-3.5 shrink-0 text-primary" />
      <code className="ltr flex-1 truncate font-mono">{url}</code>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => {
          navigator.clipboard.writeText(`curl -fsS -m 10 ${url} > /dev/null`)
          toast.success("دستور curl کپی شد — در کران یا کد سرویس بگذار")
        }}
      >
        <Copy />
      </Button>
    </div>
  )
}

export function ServiceCard({ s, serverName }: { s: ServiceDTO; serverName?: string }) {
  const [edit, setEdit] = useState(false)
  const checks = useChecks("services", s.id, "24h")
  const del = useAction(() => api(`/services/${s.id}`, { method: "DELETE" }), "سرویس حذف شد")
  const Icon = SERVICE_ICON[s.type]
  return (
    <Card className={cn("h-full gap-3 px-5", s.status === "down" && "border-danger/40")}>
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{s.name}</span>
            <StatusPill status={s.checkMethod === "none" ? "unknown" : s.status} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{SERVICE_TYPE_LABEL[s.type]}</span>
            {serverName && (
              <span className="inline-flex items-center gap-1">
                <Server className="size-3" />
                {serverName}
              </span>
            )}
            {s.hostname && <span className="ltr font-mono">{s.hostname}{s.port ? `:${s.port}` : ""}</span>}
          </div>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => setEdit(true)} aria-label="ویرایش">
            <Pencil />
          </Button>
          <ConfirmDelete what={`سرویس «${s.name}»`} onConfirm={() => del.mutateAsync(undefined)} />
        </div>
      </div>

      {s.checkMethod !== "none" && (
        <>
          <UptimeBars points={checks.data ?? []} />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              ۲۴س: <b className="text-foreground">{uptimeText(s.uptime24h)}</b> · ۷ر: <b className="text-foreground">{uptimeText(s.uptime7d)}</b>
            </span>
            <span>
              {s.latencyMs !== null && <span className="ltr num">{s.latencyMs}ms · </span>}
              {timeAgo(s.lastCheckedAt)}
            </span>
          </div>
          {s.status === "down" && s.lastError && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="truncate rounded-md bg-danger/10 px-2 py-1 text-xs text-danger">{s.lastError}</p>
              </TooltipTrigger>
              <TooltipContent>{s.lastError}</TooltipContent>
            </Tooltip>
          )}
        </>
      )}
      {s.checkMethod === "heartbeat" && s.heartbeatToken && <HeartbeatUrl token={s.heartbeatToken} />}
      {(s.path || s.notes) && (
        <div className="text-xs text-muted-foreground">
          {s.path && <div className="ltr text-start font-mono">{s.path}</div>}
          {s.notes && <div className="mt-1 line-clamp-2 whitespace-pre-line">{s.notes}</div>}
        </div>
      )}
      <div className="mt-auto flex justify-end">
        <MaintenanceMenu kind="services" id={s.id} until={s.maintenanceUntil} />
      </div>
      <ServiceFormDialog open={edit} onOpenChange={setEdit} service={s} />
    </Card>
  )
}
