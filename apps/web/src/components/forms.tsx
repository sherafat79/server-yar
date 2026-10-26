import { useEffect, useState } from "react"
import { Check, Copy, Eye, Loader2, Plus, Trash2, Wrench, X } from "lucide-react"
import { toast } from "sonner"
import { CURRENCIES, type Currency, type Named } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction } from "@/lib/queries"
import { CURRENCY, faNum, jalaliDateTime } from "@/lib/format"
import { OtpInput } from "@/components/otp-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

/** Simple object-state form helper. */
export function useFormState<T extends object>(initial: T) {
  const [v, setV] = useState<T>(initial)
  const set = <K extends keyof T>(k: K, val: T[K]) => setV((s) => ({ ...s, [k]: val }))
  return [v, set, setV] as const
}

const NONE = "__none"
const NEW = "__new"

/** Provider/vendor select with inline "add new". */
export function NamedSelect({
  id,
  items,
  value,
  onChange,
  endpoint,
  placeholder,
}: {
  id?: string
  items: Named[] | undefined
  value: number | null | undefined
  onChange: (v: number | null) => void
  endpoint: "/providers" | "/vendors"
  placeholder: string
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const create = useAction((n: string) => api<Named>(endpoint, { body: { name: n } }))

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <Input id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="نام جدید" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), name && save())} />
        <Button type="button" size="icon" onClick={() => name && save()} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Check />}
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => setAdding(false)}>
          <X />
        </Button>
      </div>
    )
  }
  async function save() {
    const row = await create.mutateAsync(name)
    onChange(row.id)
    setName("")
    setAdding(false)
  }
  return (
    <Select
      value={value ? String(value) : NONE}
      onValueChange={(v) => (v === NEW ? setAdding(true) : onChange(v === NONE ? null : Number(v)))}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— {placeholder} —</SelectItem>
        {items?.map((i) => (
          <SelectItem key={i.id} value={String(i.id)}>
            {i.name}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={NEW}>
          <Plus className="size-3.5" /> افزودن جدید…
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export function CurrencySelect({ id, value, onChange }: { id?: string; value: Currency; onChange: (v: Currency) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Currency)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c} value={c}>
            {CURRENCY[c].label} ({c})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SimpleSelect<T extends string>({ id, value, onChange, options }: { id?: string; value: T; onChange: (v: T) => void; options: Record<T, string> }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(options) as T[]).map((k) => (
          <SelectItem key={k} value={k}>
            {options[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Comma / newline separated list input. */
export function ListInput({ id, value, onChange, placeholder, ltr }: { id?: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; ltr?: boolean }) {
  const [text, setText] = useState(value.join("، "))
  useEffect(() => setText(value.join("، ")), [value.join("|")]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Input
      id={id}
      dir={ltr ? "ltr" : undefined}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onChange(
          text
            .split(/[,،\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
    />
  )
}

export function ConfirmDelete({ what, onConfirm, trigger }: { what: string; onConfirm: () => Promise<unknown>; trigger?: React.ReactNode }) {
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-danger" aria-label="حذف">
            <Trash2 />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف {what}؟</AlertDialogTitle>
          <AlertDialogDescription>این کار قابل بازگشت نیست.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>انصراف</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            حذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function MaintenanceMenu({ kind, id, until }: { kind: "servers" | "services"; id: number; until: string | null }) {
  const set = useAction(
    (u: string | null) => api(`/${kind}/${id}/maintenance`, { body: { until: u } }),
    (_) => "حالت تعمیرات به‌روز شد",
  )
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()
  if (until) {
    return (
      <Button variant="outline" size="sm" onClick={() => set.mutate(null)} disabled={set.isPending} className="border-warning/40 text-warning">
        <Wrench />
        تعمیرات تا {jalaliDateTime(until)} · پایان
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Wrench />
          حالت تعمیرات
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {[1, 3, 6, 24, 72].map((h) => (
          <DropdownMenuItem key={h} onClick={() => set.mutate(inHours(h))}>
            {h < 24 ? `${faNum(h)} ساعت` : `${faNum(h / 24)} روز`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const SECRET_LABEL = { sshPassword: "رمز SSH", sshKey: "کلید SSH", panelPassword: "رمز پنل" } as const

/** Asks for a fresh 2FA code, then shows a secret for 30 seconds. */
export function RevealSecret({ serverId, field }: { serverId: number; field: keyof typeof SECRET_LABEL }) {
  const [open, setOpen] = useState(false)
  const [otp, setOtp] = useState("")
  const [value, setValue] = useState<string | null>(null)
  const [left, setLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!value) return
    if (left <= 0) {
      setValue(null)
      setOpen(false)
      return
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(t)
  }, [value, left])

  async function submit(code: string) {
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ value: string; expiresInSec: number }>(`/servers/${serverId}/reveal`, { body: { field, otp: code } })
      setValue(r.value)
      setLeft(r.expiresInSec)
    } catch (e) {
      setError((e as Error).message)
      setOtp("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`نمایش ${SECRET_LABEL[field]}`}>
        <Eye />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) {
            setValue(null)
            setOtp("")
            setError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>نمایش {SECRET_LABEL[field]}</DialogTitle>
            <DialogDescription>{value ? `بعد از ${faNum(left)} ثانیه بسته می‌شود.` : "برای امنیت، کد تازهٔ اپ Authenticator را وارد کن."}</DialogDescription>
          </DialogHeader>
          {value ? (
            <div className="grid gap-3">
              <pre className="ltr max-h-60 overflow-auto rounded-lg bg-muted p-3 font-mono text-sm break-all whitespace-pre-wrap">{value}</pre>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${(left / 30) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 py-2">
              <OtpInput value={otp} onChange={setOtp} onComplete={submit} autoFocus />
              {busy && <Loader2 className="mx-auto animate-spin text-muted-foreground" />}
              {error && <p className="text-center text-sm text-danger">{error}</p>}
            </div>
          )}
          {value && (
            <DialogFooter>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(value)
                  toast.success("کپی شد")
                }}
              >
                <Copy />
                کپی
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CopyText({ text, className }: { text: string; className?: string }) {
  return (
    <button
      type="button"
      className={className ?? "inline-flex items-center gap-1 rounded px-1 font-mono text-[0.85em] hover:bg-accent"}
      dir="ltr"
      onClick={() => {
        navigator.clipboard.writeText(text)
        toast.success("کپی شد")
      }}
    >
      {text}
      <Copy className="size-3 opacity-50" />
    </button>
  )
}
