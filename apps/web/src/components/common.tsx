import * as React from "react"
import { motion } from "motion/react"
import type { Status } from "@serveryar/shared"
import { cn } from "@/lib/utils"
import { STATUS_LABEL } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora-blob -top-[20%] -right-[10%] h-[60vmax] w-[60vmax] bg-[var(--aurora-1)]" />
      <div className="aurora-blob top-[30%] -left-[15%] h-[50vmax] w-[50vmax] bg-[var(--aurora-2)] [animation-delay:-9s]" />
      <div className="aurora-blob -bottom-[25%] right-[20%] h-[45vmax] w-[45vmax] bg-[var(--aurora-3)] [animation-delay:-17s]" />
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}

const DOT: Record<Status, string> = {
  up: "bg-success",
  down: "bg-danger",
  pending: "bg-muted-foreground/60",
  maintenance: "bg-warning",
  unknown: "bg-muted-foreground/40",
}

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2.5 shrink-0", className)}>
      {(status === "up" || status === "down") && (
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", DOT[status], status === "up" && "[animation-duration:2.5s]")} />
      )}
      <span className={cn("relative inline-flex size-2.5 rounded-full", DOT[status])} />
    </span>
  )
}

export function StatusPill({ status }: { status: Status }) {
  const tone: Record<Status, string> = {
    up: "bg-success/12 text-success",
    down: "bg-danger/12 text-danger",
    pending: "bg-muted text-muted-foreground",
    maintenance: "bg-warning/15 text-warning",
    unknown: "bg-muted text-muted-foreground",
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", tone[status])}>
      <StatusDot status={status} className="size-2 [&>span]:size-2" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <Card className="items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary [&>svg]:size-7">{icon}</div>
      <div className="text-base font-semibold">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </Card>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  const id = React.useId()
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Staggered entrance for grids/lists. */
export const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring" as const, stiffness: 260, damping: 26 } },
  },
}

export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={stagger.container} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={stagger.item}>
      {children}
    </motion.div>
  )
}

/** Uptime-Kuma style bar strip. */
export function UptimeBars({ points, className }: { points: { ok: boolean; t: string; ms: number | null }[]; className?: string }) {
  const last = points.slice(-48)
  const pad = Array.from({ length: Math.max(0, 48 - last.length) })
  return (
    <div className={cn("flex h-7 items-stretch gap-[2px]", className)} dir="ltr">
      {pad.map((_, i) => (
        <span key={`p${i}`} className="flex-1 rounded-[2px] bg-muted" />
      ))}
      {last.map((p) => (
        <span
          key={p.t}
          title={`${new Date(p.t).toLocaleString("fa-IR")}${p.ms !== null ? ` · ${p.ms}ms` : ""}`}
          className={cn("flex-1 rounded-[2px] transition-transform hover:scale-y-110", p.ok ? "bg-success/80" : "bg-danger")}
        />
      ))}
    </div>
  )
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("ltr font-mono text-[0.85em]", className)}>{children}</span>
}
