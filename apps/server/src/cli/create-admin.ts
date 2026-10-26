/**
 * Create (or reset) a user from the command line.
 *   pnpm create-admin <username> "<display name>" [--member]
 * The password is read from SERVERYAR_PASSWORD or prompted on stdin.
 */
import { createInterface } from "node:readline/promises"
import { eq } from "drizzle-orm"
import { db, runMigrations, schema } from "../db/index.ts"
import { hashPassword } from "../lib/crypto.ts"

const [username, displayName = username] = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const role = process.argv.includes("--member") ? "member" : "admin"
if (!username) {
  console.error('usage: create-admin <username> "<display name>" [--member]')
  process.exit(1)
}

let password = process.env.SERVERYAR_PASSWORD
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  password = await rl.question("Password (min 8 chars): ")
  rl.close()
}
if (!password || password.length < 8) {
  console.error("Password must be at least 8 characters")
  process.exit(1)
}

await runMigrations()
const hash = await hashPassword(password)
const existing = await db.select().from(schema.users).where(eq(schema.users.username, username)).get()
if (existing) {
  await db
    .update(schema.users)
    .set({ passwordHash: hash, role, totpEnabled: false, totpSecret: null, totpLastStep: null, failedAttempts: 0, lockedUntil: null })
    .where(eq(schema.users.id, existing.id))
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, existing.id))
  console.log(`Reset user "${username}" (${role}). 2FA must be set up again on next login.`)
} else {
  await db.insert(schema.users).values({ username, displayName: displayName!, passwordHash: hash, role })
  console.log(`Created ${role} "${username}". Log in and scan the QR code to enable 2FA.`)
}
process.exit(0)
