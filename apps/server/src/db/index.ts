import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"
import { env } from "../env.ts"
import * as schema from "./schema.ts"

mkdirSync(dirname(env.databasePath), { recursive: true })

export const client = createClient({ url: pathToFileURL(env.databasePath).href })
export const db = drizzle(client, { schema })
export { schema }

export async function runMigrations() {
  await client.execute("PRAGMA journal_mode = WAL")
  await client.execute("PRAGMA foreign_keys = ON")
  const here = dirname(fileURLToPath(import.meta.url))
  // dev: src/db -> ../../drizzle ; prod bundle: dist -> ./drizzle
  const folder = process.env.MIGRATIONS_DIR ?? resolve(here, env.isProd ? "./drizzle" : "../../drizzle")
  await migrate(db, { migrationsFolder: folder })
}
