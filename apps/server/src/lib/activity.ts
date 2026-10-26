import { db, schema } from "../db/index.ts"

export async function logActivity(
  userId: number | null,
  action: "create" | "update" | "delete" | "renew" | "reveal" | "login" | "maintenance" | "settings",
  entity: string,
  entityId: number | null,
  summary: string,
) {
  await db.insert(schema.activity).values({ userId, action, entity, entityId, summary })
}
