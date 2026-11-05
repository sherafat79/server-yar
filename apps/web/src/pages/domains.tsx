import { useEffect, useState } from "react"
import { Globe, Loader2, Lock, Pencil, Plus, RefreshCw, Search } from "lucide-react"
import type { DomainDTO, DomainInput } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction, useCertificates, useDomains, useRegistrars, useVendors } from "@/lib/queries"
import { DOMAIN_SORTS, domainList } from "@/lib/domain-list"
import { CertificateCard, CertificateForm } from "@/components/certificates"
import { cn } from "@/lib/utils"
import { daysText, daysUntil, faNum, gregorian, jalali, money, timeAgo, urgencyClass } from "@/lib/format"
import { EmptyState, Field, PageHeader, Stagger, StaggerItem } from "@/components/common"
import { DateField } from "@/components/date-field"
import { ConfirmDelete, CurrencySelect, NamedSelect, SimpleSelect, useFormState } from "@/components/forms"
import { RenewButton } from "@/components/renew-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const blank: DomainInput = { name: "", registrar: "", vendorId: null, expiresAt: null, price: null, currency: "USD", autoRenew: false, checkSsl: true, notes: "" }

function DomainForm({ open, onOpenChange, domain }: { open: boolean; onOpenChange: (o: boolean) => void; domain?: DomainDTO }) {
  const [f, set, setAll] = useFormState<DomainInput>(blank)
  const vendors = useVendors()
  const registrars = useRegistrars()
  useEffect(() => {
    if (open) setAll(domain ? { ...blank, ...domain } : blank)
  }, [open, domain, setAll])
  const save = useAction(
    () => (domain ? api(`/domains/${domain.id}`, { method: "PATCH", body: f }) : api("/domains", { body: f })),
    domain ? "دامنه ذخیره شد" : "دامنه اضافه شد — whois و SSL در پس‌زمینه گرفته می‌شود",
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{domain ? `ویرایش ${domain.name}` : "دامنهٔ جدید"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault()
            await save.mutateAsync(undefined)
            onOpenChange(false)
          }}
        >
          <Field label="دامنه *" className="sm:col-span-2">
            <Input dir="ltr" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="example.com" required autoFocus disabled={!!domain} />
          </Field>
          <Field label="رجیسترار">
            <Input list="domain-registrars" value={f.registrar ?? ""} onChange={(e) => set("registrar", e.target.value)} placeholder="Namecheap، ایرنیک…" />
            <datalist id="domain-registrars">
              {registrars.data?.map((r) => <option key={r.name} value={r.name} />)}
            </datalist>
          </Field>
          <Field label="فروشنده">
            <NamedSelect endpoint="/vendors" items={vendors.data} value={f.vendorId} onChange={(v) => set("vendorId", v)} placeholder="بدون فروشنده" />
          </Field>
          <Field label="تاریخ انقضا" hint="خالی بگذاری، از whois پر می‌شود">
            <DateField value={f.expiresAt} onChange={(v) => set("expiresAt", v)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="قیمت سالانه">
              <Input dir="ltr" type="number" step="any" min={0} value={f.price ?? ""} onChange={(e) => set("price", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="ارز">
              <CurrencySelect value={f.currency} onChange={(v) => set("currency", v)} />
            </Field>
          </div>
          <Field label="یادداشت" className="sm:col-span-2">
            <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-6 sm:col-span-2">
            <Label className="flex items-center gap-2">
              <Switch checked={f.autoRenew} onCheckedChange={(v) => set("autoRenew", v)} /> تمدید خودکار
            </Label>
            <Label className="flex items-center gap-2">
              <Switch checked={f.checkSsl} onCheckedChange={(v) => set("checkSsl", v)} /> پایش SSL
            </Label>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              ذخیره
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DomainCard({ d, vendor }: { d: DomainDTO; vendor?: string }) {
  const [edit, setEdit] = useState(false)
  const del = useAction(() => api(`/domains/${d.id}`, { method: "DELETE" }), "دامنه حذف شد")
  const refresh = useAction(() => api(`/domains/${d.id}/refresh`, { body: {} }), "whois و SSL به‌روز شد")
  const days = d.expiresAt ? daysUntil(d.expiresAt) : null
  const sslDays = d.sslExpiresAt ? daysUntil(d.sslExpiresAt.slice(0, 10)) : null
  const whoisMismatch = d.whoisExpiresAt && d.expiresAt && d.whoisExpiresAt.slice(0, 10) !== d.expiresAt

  return (
    <Card className="h-full gap-4 px-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-chart-2/15 text-chart-2">
            <Globe className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="ltr truncate text-start font-mono font-semibold">{d.name}</div>
            <div className="text-xs text-muted-foreground">
              {d.registrar || "رجیسترار نامشخص"} · {faNum(d.serviceCount)} سرویس
            </div>
            {vendor && <div className="text-xs text-muted-foreground">فروشنده: {vendor}</div>}
          </div>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => refresh.mutate(undefined)} disabled={refresh.isPending} aria-label="به‌روزرسانی whois">
            <RefreshCw className={cn(refresh.isPending && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setEdit(true)} aria-label="ویرایش">
            <Pencil />
          </Button>
          <ConfirmDelete what={`دامنهٔ ${d.name}`} onConfirm={() => del.mutateAsync(undefined)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 p-3">
          <div className="text-[11px] text-muted-foreground">انقضای دامنه</div>
          <div className={cn("mt-0.5 font-semibold", days !== null && urgencyClass(days))}>{days === null ? "—" : daysText(days)}</div>
          {d.expiresAt && <div className="text-[11px] text-muted-foreground">{jalali(d.expiresAt)} · {gregorian(d.expiresAt)}</div>}
          {whoisMismatch && (
            <Tooltip>
              <TooltipTrigger className="mt-1 text-[10px] text-warning">whois: {jalali(d.whoisExpiresAt!)}</TooltipTrigger>
              <TooltipContent>تاریخ whois با تاریخ ثبت‌شده فرق دارد</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="size-3" /> گواهی SSL
          </div>
          <div className={cn("mt-0.5 font-semibold", sslDays !== null && urgencyClass(sslDays - 7))}>{sslDays === null ? (d.checkSsl ? "نامشخص" : "خاموش") : daysText(sslDays)}</div>
          {d.sslIssuer && <div className="truncate text-[11px] text-muted-foreground">{d.sslIssuer}</div>}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {d.price ? `${money(d.price, d.currency)} / سال` : "قیمت ثبت نشده"}
          {d.lastWhoisAt && <div className="text-[10px]">whois: {timeAgo(d.lastWhoisAt)}</div>}
        </div>
        <RenewButton kind="domains" id={d.id} name={d.name} price={d.price ?? null} currency={d.currency} due={d.expiresAt ?? null} />
      </div>
      <DomainForm open={edit} onOpenChange={setEdit} domain={d} />
    </Card>
  )
}

export default function DomainsPage() {
  const { data, isLoading } = useDomains()
  const certificates = useCertificates()
  const vendors = useVendors()
  const [open, setOpen] = useState(false)
  const [sslOpen, setSslOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [vendor, setVendor] = useState("all")
  const [sort, setSort] = useState<keyof typeof DOMAIN_SORTS>("expiryAsc")
  const q = query.trim().toLowerCase()
  const sorted = domainList(data ?? [], vendors.data ?? [], query, vendor, sort)
  const certs = (certificates.data ?? []).filter((c) => [c.hostname, c.sslIssuer, c.notes].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (a.sslExpiresAt ?? "9999").localeCompare(b.sslExpiresAt ?? "9999"))
  return (
    <>
      <PageHeader
        title="دامنه‌ها"
        description="انقضا از whois و گواهی SSL روزانه چک می‌شوند"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSslOpen(true)}><Lock /> افزودن SSL</Button>
            <Button onClick={() => setOpen(true)}>
              <Plus />
              دامنهٔ جدید
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="relative w-full max-w-sm">
        <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="جستجوی دامنه و SSL" placeholder="جستجوی دامنه، رجیسترار، SSL، یادداشت…" className="glass pr-9" />
      </div>
        <Field label="فروشنده" className="w-full sm:w-48">
          <SimpleSelect value={vendor} onChange={setVendor} options={{ all: "همهٔ فروشنده‌ها", none: "بدون فروشنده", ...Object.fromEntries(vendors.data?.map((v) => [String(v.id), v.name]) ?? []) }} />
        </Field>
        <Field label="مرتب‌سازی دامنه‌ها" className="w-full sm:w-48">
          <SimpleSelect value={sort} onChange={setSort} options={DOMAIN_SORTS} />
        </Field>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={<Globe />} title={q || vendor !== "all" ? "دامنه‌ای پیدا نشد" : "هنوز دامنه‌ای ثبت نشده"} />
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((d) => (
            <StaggerItem key={d.id}>
              <DomainCard d={d} vendor={vendors.data?.find((v) => v.id === d.vendorId)?.name} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
      <h2 className="mt-8 mb-4 font-semibold">گواهی‌های SSL مستقل</h2>
      {certificates.isLoading ? <Skeleton className="h-40 rounded-2xl" /> : certificates.isError ? (
        <div role="alert" className="text-sm text-danger">دریافت SSLها ناموفق بود <Button variant="ghost" onClick={() => certificates.refetch()}>تلاش مجدد</Button></div>
      ) : certs.length === 0 ? (
        <EmptyState icon={<Lock />} title={q ? "گواهی SSL پیدا نشد" : "هنوز SSL مستقلی ثبت نشده"} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {certs.map((c) => <CertificateCard key={c.id} certificate={c} />)}
        </div>
      )}
      <DomainForm open={open} onOpenChange={setOpen} />
      <CertificateForm open={sslOpen} onOpenChange={setSslOpen} />
    </>
  )
}
