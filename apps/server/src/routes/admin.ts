import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { namedSchema, settingsSchema, userCreateSchema, userUpdateSchema } from "@serveryar/shared"
import { requireAdmin, toUserDTO, type AppEnv } from "../auth.ts"
import { db, schema } from "../db/index.ts"
import { logActivity } from "../lib/activity.ts"
import { hashPassword } from "../lib/crypto.ts"
import { body, HttpError, idParam, notFound } from "../lib/http.ts"
import { getSettings, saveSettings } from "../lib/settings.ts"

// ---------- users (admin only) ----------
export const userRoutes = new Hono<AppEnv>()
userRoutes.use("/*", requireAdmin)

userRoutes.get("/", async (c) => {
  const rows = await db.select().from(schema.users).all()
  return c.json(rows.map(toUserDTO))
})

userRoutes.post("/", async (c) => {
  const input = await body(c, userCreateSchema)
  const exists = await db.select().from(schema.users).where(eq(schema.users.username, input.username)).get()
  if (exists) throw new HttpError(409, "username_taken")
  const [row] = await db
    .insert(schema.users)
    .values({ ...input, passwordHash: await hashPassword(input.password) })
    .returning()
  await logActivity(c.get("user").id, "create", "user", row!.id, `کاربر ${row!.displayName} ساخته شد`)
  return c.json(toUserDTO(row!))
})

userRoutes.patch("/:id", async (c) => {
  const id = idParam(c)
  const input = await body(c, userUpdateSchema)
  const me = c.get("user")
  if (id === me.id && input.role && input.role !== "admin") throw new HttpError(400, "cannot_demote_self")
  const patch: Partial<typeof schema.users.$inferInsert> = {}
  if (input.displayName) patch.displayName = input.displayName
  if (input.role) patch.role = input.role
  if (input.canRevealSecrets !== undefined) patch.canRevealSecrets = input.canRevealSecrets
  if (input.password) patch.passwordHash = await hashPassword(input.password)
  if (input.resetTotp) Object.assign(patch, { totpEnabled: false, totpSecret: null, totpLastStep: null })
  const [row] = await db.update(schema.users).set(patch).where(eq(schema.users.id, id)).returning()
  if (!row) throw notFound()
  if (input.resetTotp || input.password) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id))
  await logActivity(me.id, "update", "user", id, `کاربر ${row.displayName} ویرایش شد`)
  return c.json(toUserDTO(row))
})

userRoutes.delete("/:id", async (c) => {
  const id = idParam(c)
  if (id === c.get("user").id) throw new HttpError(400, "cannot_delete_self")
  const [row] = await db.delete(schema.users).where(eq(schema.users.id, id)).returning()
  if (!row) throw notFound()
  await logActivity(c.get("user").id, "delete", "user", id, `کاربر ${row.displayName} حذف شد`)
  return c.json({ ok: true })
})

// ---------- providers / vendors ----------
function namedRoutes(table: typeof schema.providers | typeof schema.vendors, entity: string, label: string) {
  const r = new Hono<AppEnv>()
  r.get("/", async (c) => c.json(await db.select().from(table).orderBy(table.name).all()))
  r.post("/", async (c) => {
    const input = await body(c, namedSchema)
    const [row] = await db.insert(table).values(input).returning()
    await logActivity(c.get("user").id, "create", entity, row!.id, `${label} «${row!.name}» اضافه شد`)
    return c.json(row)
  })
  r.patch("/:id", async (c) => {
    const id = idParam(c)
    const input = await body(c, namedSchema)
    const [row] = await db.update(table).set(input).where(eq(table.id, id)).returning()
    if (!row) throw notFound()
    await logActivity(c.get("user").id, "update", entity, id, `${label} «${row.name}» ویرایش شد`)
    return c.json(row)
  })
  r.delete("/:id", async (c) => {
    const id = idParam(c)
    const [row] = await db.delete(table).where(eq(table.id, id)).returning()
    if (!row) throw notFound()
    await logActivity(c.get("user").id, "delete", entity, id, `${label} «${row.name}» حذف شد`)
    return c.json({ ok: true })
  })
  return r
}
export const providerRoutes = namedRoutes(schema.providers, "provider", "پروایدر")
export const vendorRoutes = namedRoutes(schema.vendors, "vendor", "فروشنده")

// ---------- settings ----------
export const settingsRoutes = new Hono<AppEnv>()
settingsRoutes.get("/", async (c) => c.json(await getSettings()))
settingsRoutes.patch("/", requireAdmin, async (c) => {
  const input = await body(c, settingsSchema)
  const next = await saveSettings(input)
  await logActivity(c.get("user").id, "settings", "settings", null, "تنظیمات به‌روزرسانی شد")
  return c.json(next)
})
