import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { certificateSchema } from "@serveryar/shared"
import type { AppEnv } from "../auth.ts"
import { db, schema } from "../db/index.ts"
import { logActivity } from "../lib/activity.ts"
import { body, HttpError, idParam, notFound } from "../lib/http.ts"
import { refreshCertificate } from "../monitor/domains.ts"

const { certificates } = schema
export const certificateRoutes = new Hono<AppEnv>()

certificateRoutes.get("/", async (c) => c.json(await db.select().from(certificates).orderBy(certificates.hostname).all()))

certificateRoutes.post("/", async (c) => {
  const input = await body(c, certificateSchema)
  const [row] = await db.insert(certificates).values(input).onConflictDoNothing().returning()
  if (!row) throw new HttpError(409, "certificate_exists")
  await logActivity(c.get("user").id, "create", "certificate", row.id, `گواهی SSL «${row.hostname}» اضافه شد`)
  await refreshCertificate(row.id)
  return c.json(await db.select().from(certificates).where(eq(certificates.id, row.id)).get())
})

certificateRoutes.post("/:id/refresh", async (c) => {
  const id = idParam(c)
  if (!await db.select().from(certificates).where(eq(certificates.id, id)).get()) throw notFound()
  await refreshCertificate(id)
  return c.json(await db.select().from(certificates).where(eq(certificates.id, id)).get())
})

certificateRoutes.delete("/:id", async (c) => {
  const [row] = await db.delete(certificates).where(eq(certificates.id, idParam(c))).returning()
  if (!row) throw notFound()
  await logActivity(c.get("user").id, "delete", "certificate", row.id, `گواهی SSL «${row.hostname}» حذف شد`)
  return c.json({ ok: true })
})
