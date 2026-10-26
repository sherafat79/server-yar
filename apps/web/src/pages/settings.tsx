import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Bell, Building2, KeyRound, Loader2, Send, ShieldCheck, Store, Unlink, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"
import type { Named, Role, UserDTO } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction, useProviders, useSettings, useUsers, useVendors } from "@/lib/queries"
import { faNum, jalali } from "@/lib/format"
import { Field, PageHeader } from "@/components/common"
import { ConfirmDelete, SimpleSelect } from "@/components/forms"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

function TelegramCard({ user }: { user: UserDTO }) {
  const qc = useQueryClient()
  const link = useAction(() => api<{ url: string }>("/auth/telegram/link", { body: {} }))
  const unlink = useAction(() => api("/auth/telegram/link", { method: "DELETE" }), "اتصال تلگرام قطع شد")
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-4" /> تلگرام
        </CardTitle>
        <CardDescription>برای دستورهای /status ، /servers ، /renewals ، /down در پیوی ربات. نوتیف‌ها در کانال می‌آیند.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {user.telegramLinked ? (
          <>
            <span className="text-sm text-success">✓ وصل است</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await unlink.mutateAsync(undefined)
                qc.invalidateQueries({ queryKey: ["me"] })
              }}
            >
              <Unlink /> قطع اتصال
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            disabled={link.isPending}
            onClick={async () => {
              const { url } = await link.mutateAsync(undefined)
              window.open(url, "_blank", "noopener")
              toast.info("در تلگرام Start را بزن، بعد این صفحه را تازه کن")
            }}
          >
            {link.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            اتصال تلگرام
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const [cur, setCur] = useState("")
  const [next, setNext] = useState("")
  const change = useAction(() => api("/auth/password", { body: { currentPassword: cur, newPassword: next } }), "رمز عوض شد")
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> تغییر رمز عبور
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault()
            await change.mutateAsync(undefined)
            setCur("")
            setNext("")
          }}
        >
          <Field label="رمز فعلی">
            <Input type="password" dir="ltr" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label="رمز جدید (حداقل ۸ کاراکتر)">
            <Input type="password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
          </Field>
          <Button type="submit" disabled={change.isPending}>
            ذخیره
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function AddUserDialog() {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ username: "", displayName: "", password: "", role: "member" as Role })
  const create = useAction(() => api("/users", { body: f }), "کاربر ساخته شد — در اولین ورود باید ۲FA را فعال کند")
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus /> کاربر جدید
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>کاربر جدید</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            await create.mutateAsync(undefined)
            setOpen(false)
            setF({ username: "", displayName: "", password: "", role: "member" })
          }}
        >
          <Field label="نام کاربری (انگلیسی)">
            <Input dir="ltr" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required />
          </Field>
          <Field label="نام نمایشی">
            <Input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required />
          </Field>
          <Field label="رمز موقت">
            <Input dir="ltr" type="password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          </Field>
          <Field label="نقش">
            <SimpleSelect value={f.role} onChange={(role) => setF({ ...f, role })} options={{ admin: "مدیر", member: "عضو" }} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              ساخت
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UsersCard({ me }: { me: UserDTO }) {
  const users = useUsers()
  const update = useAction((v: { id: number; body: object }) => api(`/users/${v.id}`, { method: "PATCH", body: v.body }), "ذخیره شد")
  const del = useAction((id: number) => api(`/users/${id}`, { method: "DELETE" }), "کاربر حذف شد")
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> کاربران
          </CardTitle>
          <CardDescription className="mt-1">ورود همه با رمز + کد Authenticator</CardDescription>
        </div>
        <AddUserDialog />
      </CardHeader>
      <CardContent className="grid gap-2">
        {users.data?.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{u.displayName.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {u.displayName} <span className="ltr text-xs text-muted-foreground">@{u.username}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {u.role === "admin" ? "مدیر" : "عضو"} · {u.totpEnabled ? "۲FA فعال" : "۲FA تنظیم نشده"} · {u.telegramLinked ? "تلگرام وصل" : "تلگرام وصل نیست"} · از {jalali(u.createdAt)}
              </div>
            </div>
            {u.role === "member" && (
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={u.canRevealSecrets} onCheckedChange={(v) => update.mutate({ id: u.id, body: { canRevealSecrets: v } })} />
                دیدن رمزها
              </label>
            )}
            {u.id !== me.id && (
              <>
                <SimpleSelect value={u.role} onChange={(role) => update.mutate({ id: u.id, body: { role } })} options={{ admin: "مدیر", member: "عضو" }} />
                <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: u.id, body: { resetTotp: true } })} title="ریست ۲FA">
                  <ShieldCheck />
                </Button>
                <ConfirmDelete what={`کاربر ${u.displayName}`} onConfirm={() => del.mutateAsync(u.id)} />
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function NamedListCard({ title, icon, endpoint, items }: { title: string; icon: React.ReactNode; endpoint: string; items: Named[] | undefined }) {
  const [name, setName] = useState("")
  const add = useAction(() => api(endpoint, { body: { name } }), "اضافه شد")
  const del = useAction((id: number) => api(`${endpoint}/${id}`, { method: "DELETE" }), "حذف شد")
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim()) return
            await add.mutateAsync(undefined)
            setName("")
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام جدید" />
          <Button type="submit" variant="secondary" disabled={add.isPending}>
            افزودن
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {items?.map((i) => (
            <span key={i.id} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 ps-3 pe-1 text-sm">
              {i.name}
              <ConfirmDelete what={`«${i.name}»`} onConfirm={() => del.mutateAsync(i.id)} />
            </span>
          ))}
          {!items?.length && <span className="text-sm text-muted-foreground">خالی</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function RemindersCard() {
  const { data } = useSettings()
  const [days, setDays] = useState("")
  const [hour, setHour] = useState(10)
  const [backup, setBackup] = useState(3)
  useEffect(() => {
    if (data) {
      setDays(data.reminderDays.join(", "))
      setHour(data.reminderHour)
      setBackup(data.backupHour)
    }
  }, [data])
  const save = useAction(
    () =>
      api("/settings", {
        method: "PATCH",
        body: {
          reminderDays: days.split(/[,،\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0),
          reminderHour: hour,
          backupHour: backup,
        },
      }),
    "تنظیمات یادآوری ذخیره شد",
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4" /> یادآوری‌ها و بکاپ
        </CardTitle>
        <CardDescription>ساعت‌ها به وقت تهران · بکاپ دیتابیس به پیوی مدیرها فرستاده می‌شود</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(undefined)
          }}
        >
          <Field label="روزهای یادآوری قبل از سررسید" hint="۰ یعنی روز سررسید">
            <Input dir="ltr" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <Field label="ساعت ارسال">
            <Input dir="ltr" type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
          </Field>
          <Field label="ساعت بکاپ">
            <Input dir="ltr" type="number" min={0} max={23} value={backup} onChange={(e) => setBackup(Number(e.target.value))} />
          </Field>
          <Button type="submit" disabled={save.isPending}>
            ذخیره
          </Button>
        </form>
        {data && (
          <p className="mt-3 text-xs text-muted-foreground">
            الان: {data.reminderDays.map((d) => faNum(d)).join("، ")} روز قبل، ساعت {faNum(data.reminderHour)} · SSL: {data.sslReminderDays.map((d) => faNum(d)).join("، ")} روز قبل
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function SettingsPage({ user }: { user: UserDTO }) {
  const providers = useProviders()
  const vendors = useVendors()
  const isAdmin = user.role === "admin"
  return (
    <>
      <PageHeader title="تنظیمات" description={`${user.displayName} · ${isAdmin ? "مدیر" : "عضو"}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TelegramCard user={user} />
        <PasswordCard />
        {isAdmin && (
          <div className="lg:col-span-2">
            <UsersCard me={user} />
          </div>
        )}
        <NamedListCard title="پروایدرها / دیتاسنترها" icon={<Building2 className="size-4" />} endpoint="/providers" items={providers.data} />
        <NamedListCard title="فروشنده‌ها" icon={<Store className="size-4" />} endpoint="/vendors" items={vendors.data} />
        {isAdmin && (
          <div className="lg:col-span-2">
            <RemindersCard />
          </div>
        )}
      </div>
    </>
  )
}
