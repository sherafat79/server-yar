import { eq } from "drizzle-orm"
import type { Context, MiddlewareHandler } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import * as OTPAuth from "otpauth"
import type { UserDTO } from "@serveryar/shared"
import { db, schema } from "./db/index.ts"
import { env } from "./env.ts"
import { decrypt, encrypt, randomToken, sha256 } from "./lib/crypto.ts"

export type User = typeof schema.users.$inferSelect
export type AppEnv = { Variables: { user: User } }

const COOKIE = "sy_session"
const SESSION_DAYS = 7

export async function createSession(c: Context, userId: number) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt: expiresAt.toISOString() })
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.publicUrl.startsWith("https://"),
    path: "/",
    expires: expiresAt,
  })
}

export async function destroySession(c: Context) {
  const token = getCookie(c, COOKIE)
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)))
  deleteCookie(c, COOKIE, { path: "/" })
}

/** Routes a logged-in user may reach before finishing 2FA setup. */
const SETUP_ALLOWED = ["/api/auth/me", "/api/auth/logout", "/api/auth/totp/setup", "/api/auth/totp/confirm"]

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE)
  if (!token) return c.json({ error: "unauthorized" }, 401)
  const row = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.id, sha256(token)))
    .get()
  if (!row || row.session.expiresAt < new Date().toISOString()) {
    deleteCookie(c, COOKIE, { path: "/" })
    return c.json({ error: "unauthorized" }, 401)
  }
  if (!row.user.totpEnabled && !SETUP_ALLOWED.includes(c.req.path)) {
    return c.json({ error: "totp_setup_required" }, 403)
  }
  c.set("user", row.user)
  await next()
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("user").role !== "admin") return c.json({ error: "forbidden" }, 403)
  await next()
}

export function canReveal(user: User) {
  return user.role === "admin" || user.canRevealSecrets
}

// ---------- TOTP ----------
function totpFor(username: string, base32: string) {
  return new OTPAuth.TOTP({
    issuer: "ServerYar",
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32),
  })
}

export function newTotpSecret(username: string) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32
  return { secret, encrypted: encrypt(secret), uri: totpFor(username, secret).toString() }
}

/** Verifies a code and rejects reuse of an already-accepted time step. */
export async function verifyTotp(user: User, code: string): Promise<boolean> {
  if (!user.totpSecret) return false
  const totp = totpFor(user.username, decrypt(user.totpSecret))
  const delta = totp.validate({ token: code, window: 1 })
  if (delta === null) return false
  const step = Math.floor(Date.now() / 30_000) + delta
  if (user.totpLastStep !== null && step <= user.totpLastStep) return false
  await db.update(schema.users).set({ totpLastStep: step }).where(eq(schema.users.id, user.id))
  user.totpLastStep = step
  return true
}

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    totpEnabled: u.totpEnabled,
    telegramLinked: !!u.telegramChatId,
    canRevealSecrets: canReveal(u),
    createdAt: u.createdAt,
  }
}

// ---------- simple in-memory rate limit ----------
const hits = new Map<string, { count: number; reset: number }>()
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || h.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  h.count++
  return h.count <= max
}
