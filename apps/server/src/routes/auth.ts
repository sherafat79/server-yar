import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { getConnInfo } from "@hono/node-server/conninfo"
import QRCode from "qrcode"
import { changePasswordSchema, loginSchema, totpConfirmSchema } from "@serveryar/shared"
import { createSession, destroySession, newTotpSecret, rateLimit, requireAuth, toUserDTO, verifyTotp, type AppEnv } from "../auth.ts"
import { db, schema } from "../db/index.ts"
import { logActivity } from "../lib/activity.ts"
import { hashPassword, randomToken, verifyPassword } from "../lib/crypto.ts"
import { body, HttpError } from "../lib/http.ts"
import { botUsername } from "../telegram/bot.ts"

const MAX_FAILS = 5
const LOCK_MS = 15 * 60_000

export const authRoutes = new Hono<AppEnv>()

authRoutes.post("/login", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? getConnInfo(c).remote.address ?? "?"
  if (!rateLimit(`login:${ip}`, 30, 15 * 60_000)) throw new HttpError(429, "too_many_requests")

  const input = await body(c, loginSchema)
  const user = await db.select().from(schema.users).where(eq(schema.users.username, input.username)).get()
  if (!user) {
    await verifyPassword(input.password, "scrypt$AAAA$AAAA") // even out timing
    throw new HttpError(401, "invalid_credentials")
  }
  if (user.lockedUntil && user.lockedUntil > new Date().toISOString()) {
    throw new HttpError(423, "locked", { until: user.lockedUntil })
  }

  const fail = async () => {
    const fails = user.failedAttempts + 1
    const locked = fails >= MAX_FAILS
    await db
      .update(schema.users)
      .set({
        failedAttempts: locked ? 0 : fails,
        lockedUntil: locked ? new Date(Date.now() + LOCK_MS).toISOString() : user.lockedUntil,
      })
      .where(eq(schema.users.id, user.id))
    throw new HttpError(locked ? 423 : 401, locked ? "locked" : "invalid_credentials")
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) return fail()
  if (user.totpEnabled) {
    if (!input.otp) return c.json({ needOtp: true })
    if (!(await verifyTotp(user, input.otp))) return fail()
  }

  await db.update(schema.users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(schema.users.id, user.id))
  await createSession(c, user.id)
  await logActivity(user.id, "login", "user", user.id, `ورود ${user.displayName}`)
  return c.json({ user: toUserDTO(user) })
})

authRoutes.use("/*", requireAuth)

authRoutes.post("/logout", async (c) => {
  await destroySession(c)
  return c.json({ ok: true })
})

authRoutes.get("/me", (c) => c.json({ user: toUserDTO(c.get("user")) }))

authRoutes.post("/totp/setup", async (c) => {
  const user = c.get("user")
  if (user.totpEnabled) throw new HttpError(409, "totp_already_enabled")
  const { secret, encrypted, uri } = newTotpSecret(user.username)
  await db.update(schema.users).set({ totpSecret: encrypted }).where(eq(schema.users.id, user.id))
  return c.json({ secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) })
})

authRoutes.post("/totp/confirm", async (c) => {
  const user = c.get("user")
  const { otp } = await body(c, totpConfirmSchema)
  if (user.totpEnabled) throw new HttpError(409, "totp_already_enabled")
  if (!(await verifyTotp(user, otp))) throw new HttpError(400, "invalid_otp")
  await db.update(schema.users).set({ totpEnabled: true }).where(eq(schema.users.id, user.id))
  return c.json({ user: toUserDTO({ ...user, totpEnabled: true }) })
})

authRoutes.post("/password", async (c) => {
  const user = c.get("user")
  const input = await body(c, changePasswordSchema)
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw new HttpError(400, "wrong_password")
  await db.update(schema.users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(schema.users.id, user.id))
  return c.json({ ok: true })
})

authRoutes.post("/telegram/link", async (c) => {
  const user = c.get("user")
  const username = await botUsername()
  if (!username) throw new HttpError(409, "telegram_disabled")
  const code = randomToken(12)
  await db.update(schema.users).set({ telegramLinkCode: code }).where(eq(schema.users.id, user.id))
  return c.json({ url: `https://t.me/${username}?start=${code}` })
})

authRoutes.delete("/telegram/link", async (c) => {
  const user = c.get("user")
  await db.update(schema.users).set({ telegramChatId: null, telegramLinkCode: null }).where(eq(schema.users.id, user.id))
  return c.json({ ok: true })
})
