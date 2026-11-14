import { useId, useState } from "react"
import { CalendarDays, X } from "lucide-react"
import { Calendar, DateObject } from "react-multi-date-picker"
import persian from "react-date-object/calendars/persian"
import persian_fa from "react-date-object/locales/persian_fa"
import gregorianCalendar from "react-date-object/calendars/gregorian"
import gregorian_en from "react-date-object/locales/gregorian_en"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { gregorian, jalali } from "@/lib/format"
import { formatDateInput, parseDateInput, type CalendarMode } from "@/lib/date-input"

const toIso = (d: DateObject) => {
  const js = d.toDate()
  return `${js.getFullYear()}-${String(js.getMonth() + 1).padStart(2, "0")}-${String(js.getDate()).padStart(2, "0")}`
}

/** Persian/Gregorian date picker storing YYYY-MM-DD (Gregorian). */
export function DateField({ value, onChange, id }: { value: string | null | undefined; onChange: (v: string | null) => void; id?: string }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<CalendarMode>("persian")
  const [input, setInput] = useState("")
  const [error, setError] = useState(false)
  const inputId = useId()
  const changeMode = (next: CalendarMode) => {
    const draft = parseDateInput(input, mode)
    if (input.trim() && !draft) {
      setError(true)
      return
    }
    setMode(next)
    setInput(formatDateInput(draft ?? value, next))
    setError(false)
  }
  const applyInput = () => {
    const date = parseDateInput(input, mode)
    if (!date) {
      setError(true)
      return
    }
    onChange(date)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={(next) => {
      if (next) {
        setInput(formatDateInput(value, mode))
        setError(false)
      }
      setOpen(next)
    }}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="h-9 w-full justify-start gap-2 bg-transparent pl-9 font-normal">
            <CalendarDays className="size-4 text-muted-foreground" />
            {value ? (
              <span className="flex items-baseline gap-2">
                {mode === "persian" ? jalali(value) : gregorian(value)}
                <span className="text-[11px] text-muted-foreground">{mode === "persian" ? gregorian(value) : jalali(value)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">انتخاب تاریخ</span>
            )}
          </Button>
        </PopoverTrigger>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1/2 left-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
            aria-label="پاک کردن تاریخ"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="mb-3 flex gap-1" role="group" aria-label="نوع تقویم">
          <Button type="button" className="flex-1" variant={mode === "persian" ? "default" : "outline"} aria-pressed={mode === "persian"} onClick={() => changeMode("persian")}>شمسی</Button>
          <Button type="button" className="flex-1" variant={mode === "gregorian" ? "default" : "outline"} aria-pressed={mode === "gregorian"} onClick={() => changeMode("gregorian")}>میلادی</Button>
        </div>
        <label htmlFor={inputId} className="mb-1 block text-xs text-muted-foreground">تاریخ {mode === "persian" ? "شمسی" : "میلادی"} (سال/ماه/روز)</label>
        <div className="mb-2 flex gap-2">
          <Input
            id={inputId}
            dir="ltr"
            placeholder={mode === "persian" ? "1405/08/23" : "2026/11/14"}
            value={input}
            aria-invalid={error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(event) => { setInput(event.target.value); setError(false) }}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); applyInput() }
            }}
          />
          <Button type="button" variant="outline" onClick={applyInput}>ثبت</Button>
        </div>
        {error && <p id={`${inputId}-error`} role="alert" className="mb-2 text-xs text-destructive">تاریخ معتبر را به صورت سال/ماه/روز وارد کنید.</p>}
        <Calendar
          calendar={mode === "persian" ? persian : gregorianCalendar}
          locale={mode === "persian" ? persian_fa : gregorian_en}
          value={value ? new Date(`${value}T12:00:00`) : undefined}
          onChange={(d: DateObject | null) => {
            onChange(d ? toIso(d) : null)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
