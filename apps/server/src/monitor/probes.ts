import { connect as netConnect } from "node:net"
import { connect as tlsConnect } from "node:tls"
import ping from "ping"

export interface ProbeResult {
  ok: boolean
  ms: number | null
  error?: string
}

const TIMEOUT_MS = 10_000

export async function icmp(host: string): Promise<ProbeResult> {
  try {
    const r = await ping.promise.probe(host, { timeout: 3, min_reply: 1 })
    const ms = typeof r.time === "number" ? Math.round(r.time) : null
    return r.alive ? { ok: true, ms } : { ok: false, ms: null, error: "ping timeout" }
  } catch (e) {
    return { ok: false, ms: null, error: `ping: ${(e as Error).message}` }
  }
}

export function tcp(host: string, port: number, timeoutMs = 5000): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const start = performance.now()
    const sock = netConnect({ host, port })
    const done = (r: ProbeResult) => {
      sock.destroy()
      resolve(r)
    }
    sock.setTimeout(timeoutMs, () => done({ ok: false, ms: null, error: `TCP ${port} timeout` }))
    sock.once("connect", () => done({ ok: true, ms: Math.round(performance.now() - start) }))
    sock.once("error", (e) => done({ ok: false, ms: null, error: `TCP ${port}: ${e.message}` }))
  })
}

export async function http(url: string, keyword?: string | null): Promise<ProbeResult> {
  const start = performance.now()
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "ServerYar-Monitor/1.0" },
    })
    const ms = Math.round(performance.now() - start)
    if (res.status >= 400) {
      await res.body?.cancel()
      return { ok: false, ms, error: `HTTP ${res.status}` }
    }
    if (keyword) {
      const text = await res.text()
      if (!text.includes(keyword)) return { ok: false, ms, error: `کلمهٔ «${keyword}» پیدا نشد` }
    } else {
      await res.body?.cancel()
    }
    return { ok: true, ms }
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } }
    return { ok: false, ms: null, error: err.cause?.code ?? err.cause?.message ?? err.message }
  }
}

/** Reads the TLS certificate of host:443. */
export function sslCert(host: string, port = 443): Promise<{ validTo: string; issuer: string | null }> {
  return new Promise((resolve, reject) => {
    const sock = tlsConnect({ host, port, servername: host, rejectUnauthorized: false, timeout: TIMEOUT_MS })
    sock.once("secureConnect", () => {
      const cert = sock.getPeerCertificate()
      sock.end()
      if (!cert?.valid_to) return reject(new Error("no certificate"))
      const issuer = cert.issuer ? ((cert.issuer.O ?? cert.issuer.CN) as string | undefined) : undefined
      resolve({ validTo: new Date(cert.valid_to).toISOString(), issuer: issuer ?? null })
    })
    sock.once("timeout", () => {
      sock.destroy()
      reject(new Error("timeout"))
    })
    sock.once("error", reject)
  })
}

/** Run async jobs with bounded concurrency. */
export async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]!).catch((e) => console.error("[monitor]", e))
  })
  await Promise.all(workers)
}
