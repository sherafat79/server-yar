import type { DomainDTO, Named } from "@serveryar/shared"

export const DOMAIN_SORTS = {
  expiryAsc: "انقضا: نزدیک‌ترین",
  expiryDesc: "انقضا: دورترین",
  nameAsc: "نام: صعودی",
  nameDesc: "نام: نزولی",
  vendor: "نام فروشنده",
}

export function domainList(domains: DomainDTO[], vendors: Named[], query: string, vendor: string, sort: keyof typeof DOMAIN_SORTS) {
  const names = new Map(vendors.map((v) => [v.id, v.name]))
  const q = query.trim().toLowerCase()
  const vendorName = (d: DomainDTO) => d.vendorId == null ? "" : names.get(d.vendorId) ?? ""
  return domains.filter((d) => {
    if (vendor === "none" ? d.vendorId != null : vendor !== "all" && String(d.vendorId) !== vendor) return false
    return [d.name, d.registrar, d.notes, vendorName(d)].join(" ").toLowerCase().includes(q)
  }).sort((a, b) => {
    const byName = a.name.localeCompare(b.name)
    if (sort === "nameAsc") return byName
    if (sort === "nameDesc") return -byName
    if (sort === "vendor") return vendorName(a).localeCompare(vendorName(b), "fa") || byName
    if (!a.expiresAt || !b.expiresAt) return Number(!a.expiresAt) - Number(!b.expiresAt) || byName
    const byExpiry = a.expiresAt.localeCompare(b.expiresAt)
    return (sort === "expiryDesc" ? -byExpiry : byExpiry) || byName
  })
}
