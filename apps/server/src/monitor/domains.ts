import { eq } from "drizzle-orm"
import { firstResult, whoisDomain } from "whoiser"
import { db, schema } from "../db/index.ts"
import { nowIso } from "../lib/dates.ts"
import { sslCert } from "./probes.ts"

const { domains, services } = schema

const EXPIRY_KEYS = [
  "Registry Expiry Date",
  "Registrar Registration Expiration Date",
  "Expiry Date",
  "Expiration Date",
  "expire-date", // .ir
  "paid-till",
  "Expires On",
  "expires",
]

async function whoisExpiry(name: string): Promise<string | null> {
  const res = firstResult(await whoisDomain(name, { timeout: 15_000, follow: 2 }))
  for (const key of Object.keys(res)) {
    if (!EXPIRY_KEYS.some((k) => key.toLowerCase() === k.toLowerCase())) continue
    const raw = res[key]
    const v = Array.isArray(raw) ? raw[0] : raw
    const t = v ? Date.parse(v) : NaN
    if (!Number.isNaN(t)) return new Date(t).toISOString()
  }
  return null
}

/** Refresh whois expiry and SSL certificate for one domain. Errors are swallowed per step. */
export async function refreshDomain(id: number) {
  const d = await db.select().from(domains).where(eq(domains.id, id)).get()
  if (!d) return
  const patch: Partial<typeof domains.$inferInsert> = { lastWhoisAt: nowIso() }
  try {
    const exp = await whoisExpiry(d.name)
    if (exp) {
      patch.whoisExpiresAt = exp
      // keep the manual date unless empty; whois is the source of truth when nothing was entered
      if (!d.expiresAt) patch.expiresAt = exp.slice(0, 10)
    }
  } catch (e) {
    console.warn(`[whois] ${d.name}: ${(e as Error).message}`)
  }
  if (d.checkSsl) {
    for (const host of [d.name, `www.${d.name}`]) {
      try {
        const cert = await sslCert(host)
        patch.sslExpiresAt = cert.validTo
        patch.sslIssuer = cert.issuer
        break
      } catch {
        /* try next host */
      }
    }
  }
  await db.update(domains).set(patch).where(eq(domains.id, id))
}

export async function refreshAllDomains() {
  const rows = await db.select({ id: domains.id }).from(domains).all()
  for (const r of rows) await refreshDomain(r.id)
}

/** SSL expiry for HTTPS services (hostname or https check URL). */
export async function refreshServiceCerts() {
  const rows = await db.select().from(services).all()
  for (const s of rows) {
    let host = s.hostname
    if (s.checkUrl?.startsWith("https://")) host = new URL(s.checkUrl).hostname
    if (!host || !(s.type === "website" || s.type === "api" || s.type === "panel" || s.checkUrl?.startsWith("https://"))) continue
    try {
      const cert = await sslCert(host)
      await db.update(services).set({ sslExpiresAt: cert.validTo }).where(eq(services.id, s.id))
    } catch {
      /* not https or unreachable */
    }
  }
}
