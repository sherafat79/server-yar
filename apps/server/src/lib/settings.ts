import { db, schema } from "../db/index.ts"

export interface Settings {
  reminderDays: number[]
  reminderHour: number
  sslReminderDays: number[]
  backupHour: number
}

const DEFAULTS: Settings = {
  reminderDays: [7, 3, 1, 0],
  reminderHour: 10,
  sslReminderDays: [14, 7, 3, 1],
  backupHour: 3,
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(schema.settings).all()
  const out = { ...DEFAULTS } as Record<string, unknown>
  for (const r of rows) out[r.key] = r.value
  return out as unknown as Settings
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    await db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
  }
  return getSettings()
}
