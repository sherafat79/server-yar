import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { BILLING_CYCLES, type ServerDTO, type ServerInput } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction, useProviders, useVendors } from "@/lib/queries"
import { CYCLE_LABEL } from "@/lib/format"
import { Field } from "@/components/common"
import { DateField } from "@/components/date-field"
import { CurrencySelect, ListInput, NamedSelect, SimpleSelect, useFormState } from "@/components/forms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Form = Omit<ServerInput, "sshPassword" | "sshKey" | "panelPassword"> & {
  sshPassword: string
  sshKey: string
  panelPassword: string
  clear: { sshPassword: boolean; sshKey: boolean; panelPassword: boolean }
}

const blank: Form = {
  name: "",
  ips: [],
  providerId: null,
  vendorId: null,
  location: "",
  os: "",
  cpu: "",
  ram: "",
  disk: "",
  traffic: "",
  panelUrl: "",
  sshUser: "root",
  sshPort: 22,
  sshPassword: "",
  sshKey: "",
  panelUser: "",
  panelPassword: "",
  price: null,
  currency: "USD",
  billingCycle: "monthly",
  nextRenewal: null,
  autoRenew: false,
  monitor: true,
  tags: [],
  notes: "",
  archived: false,
  clear: { sshPassword: false, sshKey: false, panelPassword: false },
}

function fromDTO(s: ServerDTO): Form {
  return { ...blank, ...s, sshPassword: "", sshKey: "", panelPassword: "", clear: blank.clear }
}

const CYCLES = Object.fromEntries(BILLING_CYCLES.map((c) => [c, CYCLE_LABEL[c]])) as Record<(typeof BILLING_CYCLES)[number], string>

function SecretInput({
  label,
  has,
  value,
  onChange,
  clear,
  onClear,
  multiline,
}: {
  label: string
  has: boolean
  value: string
  onChange: (v: string) => void
  clear: boolean
  onClear: (v: boolean) => void
  multiline?: boolean
}) {
  const placeholder = has ? "•••••• ذخیره شده — خالی بگذار تا تغییر نکند" : ""
  return (
    <Field label={label}>
      <div className="grid gap-1.5">
        {multiline ? (
          <Textarea dir="ltr" className="font-mono text-xs" rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={clear} />
        ) : (
          <Input dir="ltr" type="password" autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={clear} />
        )}
        {has && (
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={clear} onChange={(e) => onClear(e.target.checked)} /> حذف مقدار ذخیره‌شده
          </label>
        )}
      </div>
    </Field>
  )
}

export function ServerFormDialog({ open, onOpenChange, server }: { open: boolean; onOpenChange: (o: boolean) => void; server?: ServerDTO }) {
  const [f, set, setAll] = useFormState<Form>(blank)
  const [tab, setTab] = useState("base")
  const providers = useProviders()
  const vendors = useVendors()

  useEffect(() => {
    if (open) {
      setAll(server ? fromDTO(server) : blank)
      setTab("base")
    }
  }, [open, server, setAll])

  const save = useAction(
    async () => {
      const secret = (k: "sshPassword" | "sshKey" | "panelPassword") => (f.clear[k] ? null : f[k] ? f[k] : undefined)
      const { clear: _c, ...rest } = f
      const payload = { ...rest, sshPassword: secret("sshPassword"), sshKey: secret("sshKey"), panelPassword: secret("panelPassword") }
      return server ? api(`/servers/${server.id}`, { method: "PATCH", body: payload }) : api("/servers", { body: payload })
    },
    server ? "سرور ذخیره شد" : "سرور اضافه شد",
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{server ? `ویرایش «${server.name}»` : "سرور جدید"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            await save.mutateAsync(undefined)
            onOpenChange(false)
          }}
        >
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="base">اطلاعات پایه</TabsTrigger>
              <TabsTrigger value="spec">مشخصات</TabsTrigger>
              <TabsTrigger value="access">دسترسی</TabsTrigger>
              <TabsTrigger value="billing">هزینه و تمدید</TabsTrigger>
            </TabsList>

            <TabsContent value="base" className="grid gap-4 pt-3 sm:grid-cols-2">
              <Field label="نام سرور *">
                <Input value={f.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
              </Field>
              <Field label="IPها" hint="با ویرگول جدا کن؛ اولی برای مانیتورینگ استفاده می‌شود">
                <ListInput ltr value={f.ips} onChange={(v) => set("ips", v)} placeholder="1.2.3.4, 2a01::1" />
              </Field>
              <Field label="پروایدر / دیتاسنتر">
                <NamedSelect endpoint="/providers" items={providers.data} value={f.providerId} onChange={(v) => set("providerId", v)} placeholder="بدون پروایدر" />
              </Field>
              <Field label="فروشنده (از کجا خریدیم)">
                <NamedSelect endpoint="/vendors" items={vendors.data} value={f.vendorId} onChange={(v) => set("vendorId", v)} placeholder="بدون فروشنده" />
              </Field>
              <Field label="لوکیشن">
                <Input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="آلمان، فالکن‌اشتاین" />
              </Field>
              <Field label="تگ‌ها">
                <ListInput value={f.tags} onChange={(v) => set("tags", v)} placeholder="prod، bot" />
              </Field>
              <Field label="یادداشت" className="sm:col-span-2">
                <Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-6 sm:col-span-2">
                <Label className="flex items-center gap-2">
                  <Switch checked={f.monitor} onCheckedChange={(v) => set("monitor", v)} /> مانیتورینگ آپ‌تایم
                </Label>
                <Label className="flex items-center gap-2">
                  <Switch checked={f.archived} onCheckedChange={(v) => set("archived", v)} /> بایگانی‌شده
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="spec" className="grid gap-4 pt-3 sm:grid-cols-2">
              <Field label="سیستم‌عامل">
                <Input dir="ltr" value={f.os ?? ""} onChange={(e) => set("os", e.target.value)} placeholder="Ubuntu 24.04" />
              </Field>
              <Field label="CPU">
                <Input dir="ltr" value={f.cpu ?? ""} onChange={(e) => set("cpu", e.target.value)} placeholder="4 vCPU" />
              </Field>
              <Field label="RAM">
                <Input dir="ltr" value={f.ram ?? ""} onChange={(e) => set("ram", e.target.value)} placeholder="8 GB" />
              </Field>
              <Field label="دیسک">
                <Input dir="ltr" value={f.disk ?? ""} onChange={(e) => set("disk", e.target.value)} placeholder="160 GB NVMe" />
              </Field>
              <Field label="ترافیک">
                <Input dir="ltr" value={f.traffic ?? ""} onChange={(e) => set("traffic", e.target.value)} placeholder="20 TB" />
              </Field>
            </TabsContent>

            <TabsContent value="access" className="grid gap-4 pt-3 sm:grid-cols-2">
              <Field label="کاربر SSH">
                <Input dir="ltr" value={f.sshUser ?? ""} onChange={(e) => set("sshUser", e.target.value)} />
              </Field>
              <Field label="پورت SSH">
                <Input dir="ltr" type="number" value={f.sshPort ?? ""} onChange={(e) => set("sshPort", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <SecretInput
                label="رمز SSH"
                has={!!server?.hasSshPassword}
                value={f.sshPassword}
                onChange={(v) => set("sshPassword", v)}
                clear={f.clear.sshPassword}
                onClear={(v) => set("clear", { ...f.clear, sshPassword: v })}
              />
              <SecretInput
                label="کلید خصوصی SSH"
                multiline
                has={!!server?.hasSshKey}
                value={f.sshKey}
                onChange={(v) => set("sshKey", v)}
                clear={f.clear.sshKey}
                onClear={(v) => set("clear", { ...f.clear, sshKey: v })}
              />
              <Field label="لینک پنل" className="sm:col-span-2">
                <Input dir="ltr" value={f.panelUrl ?? ""} onChange={(e) => set("panelUrl", e.target.value)} placeholder="https://panel.provider.com" />
              </Field>
              <Field label="کاربر پنل">
                <Input dir="ltr" value={f.panelUser ?? ""} onChange={(e) => set("panelUser", e.target.value)} />
              </Field>
              <SecretInput
                label="رمز پنل"
                has={!!server?.hasPanelPassword}
                value={f.panelPassword}
                onChange={(v) => set("panelPassword", v)}
                clear={f.clear.panelPassword}
                onClear={(v) => set("clear", { ...f.clear, panelPassword: v })}
              />
              <p className="text-[11px] text-muted-foreground sm:col-span-2">🔒 رمزها با AES-256-GCM رمزنگاری می‌شوند و فقط با کد ۲FA تازه قابل مشاهده‌اند.</p>
            </TabsContent>

            <TabsContent value="billing" className="grid gap-4 pt-3 sm:grid-cols-2">
              <Field label="قیمت هر دوره">
                <Input dir="ltr" type="number" step="any" min={0} value={f.price ?? ""} onChange={(e) => set("price", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <Field label="ارز">
                <CurrencySelect value={f.currency} onChange={(v) => set("currency", v)} />
              </Field>
              <Field label="دورهٔ پرداخت">
                <SimpleSelect value={f.billingCycle} onChange={(v) => set("billingCycle", v)} options={CYCLES} />
              </Field>
              <Field label="سررسید بعدی">
                <DateField value={f.nextRenewal} onChange={(v) => set("nextRenewal", v)} />
              </Field>
              <Label className="flex items-center gap-2 sm:col-span-2">
                <Switch checked={f.autoRenew} onCheckedChange={(v) => set("autoRenew", v)} />
                تمدید خودکار (بعد از سررسید، تاریخ خودش جلو می‌رود و پرداخت ثبت می‌شود)
              </Label>
            </TabsContent>
          </Tabs>

          <DialogFooter>
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
