import { useState } from "react"
import { CalendarDays, X } from "lucide-react"
import { Calendar, DateObject } from "react-multi-date-picker"
import persian from "react-date-object/calendars/persian"
import persian_fa from "react-date-object/locales/persian_fa"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { gregorian, jalali } from "@/lib/format"

const toIso = (d: DateObject) => {
  const js = d.toDate()
  return `${js.getFullYear()}-${String(js.getMonth() + 1).padStart(2, "0")}-${String(js.getDate()).padStart(2, "0")}`
}

/** Jalali date picker storing YYYY-MM-DD (Gregorian). */
export function DateField({ value, onChange, id }: { value: string | null | undefined; onChange: (v: string | null) => void; id?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="h-9 w-full justify-start gap-2 bg-transparent font-normal">
            <CalendarDays className="size-4 text-muted-foreground" />
            {value ? (
              <span className="flex items-baseline gap-2">
                {jalali(value)}
                <span className="text-[11px] text-muted-foreground">{gregorian(value)}</span>
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
        <Calendar
          calendar={persian}
          locale={persian_fa}
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
