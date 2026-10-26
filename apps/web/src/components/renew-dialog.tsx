import { useEffect, useState } from "react"
import { CalendarCheck, Loader2 } from "lucide-react"
import type { Currency } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useAction } from "@/lib/queries"
import { jalali, todayIso } from "@/lib/format"
import { Field } from "@/components/common"
import { DateField } from "@/components/date-field"
import { CurrencySelect } from "@/components/forms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

/** «تمدید شد» — records a payment and moves the due date one period forward. */
export function RenewButton({
  kind,
  id,
  name,
  price,
  currency,
  due,
  size = "sm",
}: {
  kind: "servers" | "domains"
  id: number
  name: string
  price: number | null
  currency: Currency
  due: string | null
  size?: "sm" | "default"
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<number | "">(price ?? "")
  const [cur, setCur] = useState<Currency>(currency)
  const [paidAt, setPaidAt] = useState<string | null>(todayIso())
  const [note, setNote] = useState("")

  useEffect(() => {
    if (open) {
      setAmount(price ?? "")
      setCur(currency)
      setPaidAt(todayIso())
      setNote("")
    }
  }, [open, price, currency])

  const renew = useAction(
    () => api(`/${kind}/${id}/renew`, { body: { amount: amount === "" ? 0 : amount, currency: cur, paidAt: paidAt ?? undefined, note: note || null } }),
    `«${name}» تمدید شد`,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="outline" className="border-success/40 text-success hover:bg-success/10">
          <CalendarCheck />
          تمدید شد
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ثبت تمدید «{name}»</DialogTitle>
          <DialogDescription>
            {due ? `سررسید فعلی ${jalali(due)} یک دوره جلو می‌رود.` : "سررسید از امروز محاسبه می‌شود."} پرداخت در تاریخچهٔ هزینه‌ها ثبت می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="مبلغ پرداختی">
            <Input dir="ltr" type="number" step="any" min={0} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="ارز">
            <CurrencySelect value={cur} onChange={setCur} />
          </Field>
          <Field label="تاریخ پرداخت">
            <DateField value={paidAt} onChange={setPaidAt} />
          </Field>
          <Field label="یادداشت">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختیاری" />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={renew.isPending}
            onClick={async () => {
              await renew.mutateAsync(undefined)
              setOpen(false)
            }}
          >
            {renew.isPending && <Loader2 className="animate-spin" />}
            ثبت تمدید
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
