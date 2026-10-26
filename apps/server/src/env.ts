import { resolve } from "node:path"

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var ${name} (see .env.example)`)
  return v
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  publicUrl: (process.env.PUBLIC_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  encryptionKey: Buffer.from(required("ENCRYPTION_KEY"), "base64"),
  databasePath: resolve(process.env.DATABASE_PATH ?? "./data/serveryar.db"),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || null,
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || null,
  telegramProxy: process.env.TELEGRAM_PROXY || null,
  webDist: process.env.WEB_DIST ? resolve(process.env.WEB_DIST) : null,
  isProd: process.env.NODE_ENV === "production",
  timezone: "Asia/Tehran",
}

if (env.encryptionKey.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be 32 bytes encoded as base64")
}
