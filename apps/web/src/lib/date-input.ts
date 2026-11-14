import DateObject from "react-date-object"
import gregorian from "react-date-object/calendars/gregorian"
import persian from "react-date-object/calendars/persian"
import gregorian_en from "react-date-object/locales/gregorian_en"

export type CalendarMode = "persian" | "gregorian"

export function formatDateInput(value: string | null | undefined, mode: CalendarMode) {
  if (!value) return ""
  return new DateObject({ date: value, format: "YYYY-MM-DD" })
    .convert(mode === "persian" ? persian : gregorian, gregorian_en)
    .format("YYYY/MM/DD")
}

export function parseDateInput(value: string, mode: CalendarMode): string | null {
  const normalized = value.trim().replace(/[۰-۹٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit >= "۰" ? 1776 : 1632)),
  )
  const parts = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(normalized)
  if (!parts) return null
  const [, year, month, day] = parts.map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new DateObject({ year, month, day, calendar: mode === "persian" ? persian : gregorian })
  // DateObject normalizes overflowing dates; reject them instead of changing the user's input.
  if (!date.isValid || date.year !== year || date.month.number !== month || date.day !== day) return null
  const iso = date.convert(gregorian, gregorian_en).format("YYYY-MM-DD")
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}
