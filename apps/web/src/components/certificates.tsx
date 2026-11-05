import { useEffect, useState } from "react"
import { Loader2, Lock, RefreshCw } from "lucide-react"
import type { CertificateDTO } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { daysText, daysUntil, gregorian, jalali, timeAgo, urgencyClass } from "@/lib/format"
import { Field } from "@/components/common"
import { ConfirmDelete } from "@/components/forms"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function CertificateForm({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [hostname, setHostname] = useState("")
  const [notes, setNotes] = useState("")
  useEffect(() => {
    if (open) { setHostname(""); setNotes("") }
  }, [open])
  const save = useAction(() => api("/certificates", { body: { hostname, notes } }), "SSL ثبت و بررسی شد")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>افزودن SSL مستقل</DialogTitle>
          <DialogDescription>نام دامنه یا زیردامنه را وارد کن؛ گواهی از پورت ۴۴۳ دریافت و انقضای آن روزانه بررسی می‌شود.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault()
          try { await save.mutateAsync(undefined); onOpenChange(false) } catch { /* error is shown by useAction */ }
        }}>
          <Field label="نام میزبان *" hint="بدون https:// یا مسیر">
            <Input dir="ltr" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="api.example.com" required autoFocus maxLength={253} />
          </Field>
          <Field label="یادداشت">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} rows={2} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} ذخیره
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CertificateCard({ certificate: c }: { certificate: CertificateDTO }) {
  const refresh = useAction(() => api(`/certificates/${c.id}/refresh`, { body: {} }), "بررسی SSL انجام شد")
  const del = useAction(() => api(`/certificates/${c.id}`, { method: "DELETE" }), "SSL حذف شد")
  const days = c.sslExpiresAt ? daysUntil(c.sslExpiresAt.slice(0, 10)) : null
  return (
    <Card className="h-full gap-3 px-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Lock className="size-5 shrink-0 text-chart-2" />
          <span dir="ltr" className="truncate font-mono font-semibold">{c.hostname}</span>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => refresh.mutate(undefined)} disabled={refresh.isPending} aria-label="بررسی مجدد SSL">
            <RefreshCw className={cn(refresh.isPending && "animate-spin")} />
          </Button>
          <ConfirmDelete what={`SSL ${c.hostname}`} onConfirm={() => del.mutateAsync(undefined)} />
        </div>
      </div>
      <div className={cn("font-semibold", days !== null && urgencyClass(days - 7))}>{days === null ? "انقضا نامشخص" : daysText(days)}</div>
      {c.sslExpiresAt && <div className="text-xs text-muted-foreground">{jalali(c.sslExpiresAt)} · {gregorian(c.sslExpiresAt)}</div>}
      {c.sslIssuer && <div className="text-xs text-muted-foreground">{c.sslIssuer}</div>}
      {c.lastError && <p role="status" className="text-xs text-danger">{c.lastError}</p>}
      {c.notes && <p className="text-xs whitespace-pre-wrap break-words">{c.notes}</p>}
      {c.lastCheckedAt && <div className="mt-auto text-[11px] text-muted-foreground">آخرین بررسی: {timeAgo(c.lastCheckedAt)}</div>}
    </Card>
  )
}
