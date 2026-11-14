import assert from "node:assert/strict"
import { test } from "node:test"
import { formatDateInput, parseDateInput } from "../src/lib/date-input.ts"

test("both calendars and Persian/Arabic digits produce the same Gregorian date", () => {
  for (const value of ["1405/8/23", "۱۴۰۵/۰۸/۲۳", "١٤٠٥-٠٨-٢٣"]) {
    assert.equal(parseDateInput(value, "persian"), "2026-11-14")
  }
  assert.equal(parseDateInput("2026/11/14", "gregorian"), "2026-11-14")
  assert.equal(parseDateInput("۲۰۲۶-۱۱-۱۴", "gregorian"), "2026-11-14")
})

test("calendar switching round trips without changing the stored day", () => {
  for (const iso of ["2026-11-14", "2024-02-29", "2025-03-20", "2025-03-21"]) {
    for (const mode of ["persian", "gregorian"] as const) {
      assert.equal(parseDateInput(formatDateInput(iso, mode), mode), iso)
    }
  }
  assert.equal(formatDateInput(null, "persian"), "")
})

test("rejects invalid dates instead of silently rolling into another month", () => {
  for (const value of ["", "abc", "2026/2/29", "2026/4/31", "2026/0/10", "2026/13/1", "2026/1/0", "0000/1/1", "2026/11/14extra"]) {
    assert.equal(parseDateInput(value, "gregorian"), null, value)
  }
  for (const value of ["1405/7/31", "1404/12/30"]) {
    assert.equal(parseDateInput(value, "persian"), null, value)
  }
  assert.equal(parseDateInput("1403/12/30", "persian"), "2025-03-20")
})
