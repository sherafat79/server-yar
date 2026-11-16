import type { ServerDTO, ServiceDTO } from "@serveryar/shared"

export const RESOURCE_SORTS = {
  nameAsc: "نام از الف تا ی",
  nameDesc: "نام از ی تا الف",
  downFirst: "ابتدا موارد قطع",
  renewalAsc: "نزدیک‌ترین تمدید",
  renewalDesc: "دورترین تمدید",
}

export type ResourceSort = keyof typeof RESOURCE_SORTS

const names = new Intl.Collator("fa", { numeric: true, sensitivity: "base" })

export function compareResources(a: ServerDTO | ServiceDTO, b: ServerDTO | ServiceDTO, sort: ResourceSort) {
  const byName = names.compare(a.name, b.name)
  switch (sort) {
    case "nameAsc": return byName
    case "nameDesc": return -byName
    case "downFirst": return Number(b.status === "down") - Number(a.status === "down") || byName
    default:
      if (!a.nextRenewal || !b.nextRenewal) return Number(!a.nextRenewal) - Number(!b.nextRenewal) || byName
      const byRenewal = a.nextRenewal.localeCompare(b.nextRenewal)
      return (sort === "renewalDesc" ? -byRenewal : byRenewal) || byName
  }
}
