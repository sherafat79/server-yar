import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { SERVICE_TYPES, type CheckMethod, type ServiceDTO, type ServiceInput, type ServiceType } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction, useDomains, useServers } from "@/lib/queries"
import { SERVICE_TYPE_LABEL } from "@/lib/format"
import { Field } from "@/components/common"
import { ListInput, SimpleSelect, useFormState } from "@/components/forms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const TYPES = Object.fromEntries(SERVICE_TYPES.map((t) => [t, SERVICE_TYPE_LABEL[t]])) as Record<ServiceType, string>
const METHODS: Record<CheckMethod, string> = {
  http: "HTTP(S) — وب‌سایت / API",
  tcp: "TCP — باز بودن پورت",
  heartbeat: "Heartbeat — سرویس خودش خبر می‌دهد",
  none: "بدون چک",
}
/** Sensible default check per type. */
const DEFAULT_METHOD: Record<ServiceType, CheckMethod> = {
  telegram_bot: "heartbeat",
  worker: "heartbeat",
  website: "http",
  api: "http",
  panel: "http",
  database: "tcp",
  other: "none",
}

const blank: ServiceInput = {
  name: "",
  type: "website",
  serverId: null,
  domainId: null,
  hostname: "",
  port: null,
  checkMethod: "http",
  checkUrl: "",
  checkKeyword: "",
  heartbeatGraceSec: 600,
  path: "",
  tags: [],
  notes: "",
}

const NONE = "__none"

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  defaults,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  service?: ServiceDTO
  defaults?: Partial<ServiceInput>
}) {
  const [f, set, setAll] = useFormState<ServiceInput>(blank)
  const servers = useServers()
  const domains = useDomains()

  useEffect(() => {
    if (open) setAll(service ? { ...blank, ...service } : { ...blank, ...defaults })
  }, [open, service, setAll]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useAction(
    () => (service ? api(`/services/${service.id}`, { method: "PATCH", body: f }) : api("/services", { body: f })),
    service ? "سرویس ذخیره شد" : "سرویس اضافه شد",
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{service ? `ویرایش «${service.name}»` : "سرویس جدید"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault()
            await save.mutateAsync(undefined)
            onOpenChange(false)
          }}
        >
          <Field label="نام سرویس *">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
          </Field>
          <Field label="نوع">
            <SimpleSelect
              value={f.type}
              onChange={(t) => {
                set("type", t)
                if (!service) set("checkMethod", DEFAULT_METHOD[t])
              }}
              options={TYPES}
            />
          </Field>
          <Field label="سرور">
            <Select value={f.serverId ? String(f.serverId) : NONE} onValueChange={(v) => set("serverId", v === NONE ? null : Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— بدون سرور —</SelectItem>
                {servers.data?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="دامنه (اختیاری)" hint="اگر خالی باشد از روی هاست خودکار پیدا می‌شود">
            <Select value={f.domainId ? String(f.domainId) : NONE} onValueChange={(v) => set("domainId", v === NONE ? null : Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— بدون دامنه —</SelectItem>
                {domains.data?.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="هاست / ساب‌دامین">
            <Input dir="ltr" value={f.hostname ?? ""} onChange={(e) => set("hostname", e.target.value)} placeholder="api.example.com" />
          </Field>
          <Field label="پورت">
            <Input dir="ltr" type="number" value={f.port ?? ""} onChange={(e) => set("port", e.target.value ? Number(e.target.value) : null)} placeholder="443" />
          </Field>

          <div className="grid gap-4 rounded-xl border border-glass-border bg-muted/30 p-4 sm:col-span-2 sm:grid-cols-2">
            <Field label="روش چک سلامت" className="sm:col-span-2">
              <SimpleSelect value={f.checkMethod} onChange={(v) => set("checkMethod", v)} options={METHODS} />
            </Field>
            {f.checkMethod === "http" && (
              <>
                <Field label="URL چک" hint="خالی = https://هاست">
                  <Input dir="ltr" value={f.checkUrl ?? ""} onChange={(e) => set("checkUrl", e.target.value)} placeholder="https://example.com/health" />
                </Field>
                <Field label="کلمهٔ کلیدی (اختیاری)" hint="اگر در پاسخ نباشد، قطع حساب می‌شود">
                  <Input value={f.checkKeyword ?? ""} onChange={(e) => set("checkKeyword", e.target.value)} />
                </Field>
              </>
            )}
            {f.checkMethod === "tcp" && <p className="text-xs text-muted-foreground sm:col-span-2">به هاست (یا IP سرور) روی پورت بالا وصل می‌شود.</p>}
            {f.checkMethod === "heartbeat" && (
              <Field label="مهلت (ثانیه)" hint="اگر در این مدت پینگ نرسد، قطع حساب می‌شود. آدرس بعد از ذخیره نمایش داده می‌شود." className="sm:col-span-2">
                <Input dir="ltr" type="number" min={60} value={f.heartbeatGraceSec} onChange={(e) => set("heartbeatGraceSec", Number(e.target.value))} />
              </Field>
            )}
          </div>

          <Field label="مسیر روی سرور / کانتینر">
            <Input dir="ltr" value={f.path ?? ""} onChange={(e) => set("path", e.target.value)} placeholder="/opt/bot یا docker: shop-bot" />
          </Field>
          <Field label="تگ‌ها">
            <ListInput value={f.tags} onChange={(v) => set("tags", v)} />
          </Field>
          <Field label="یادداشت" className="sm:col-span-2">
            <Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={save.isPending || !f.name}>
              {save.isPending && <Loader2 className="animate-spin" />}
              ذخیره
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
